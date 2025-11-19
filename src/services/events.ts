import { Firestore, Timestamp, FieldValue } from 'firebase-admin/firestore';
import { StudyEvent } from '../types';
import { v4 as uuidv4 } from 'uuid';

export class EventService {
  private db: Firestore;

  constructor(db: Firestore) {
    this.db = db;
  }

  /**
   * Creates a new study event
   */
  async createEvent(
    serverId: string,
    creatorId: string,
    creatorUsername: string,
    title: string,
    location: string,
    startTime: Date,
    duration: number | undefined,
    studyType: 'silent' | 'conversation' | 'pomodoro' | 'custom',
    options: {
      description?: string;
      maxAttendees?: number;
      customType?: string;
    } = {}
  ): Promise<StudyEvent> {
    const eventId = uuidv4();
    const now = Timestamp.now();

    const event: StudyEvent = {
      eventId,
      serverId,
      creatorId,
      creatorUsername,
      title,
      location,
      startTime: Timestamp.fromDate(startTime),
      studyType,
      attendees: [
        {
          userId: creatorId,
          username: creatorUsername,
          joinedAt: now,
        },
      ],
      createdAt: now,
    };

    // Only add optional fields if they have values
    if (duration) {
      event.duration = duration;
    }
    if (options.description) {
      event.description = options.description;
    }
    if (options.maxAttendees) {
      event.maxAttendees = options.maxAttendees;
    }
    if (options.customType) {
      event.customType = options.customType;
    }

    await this.db
      .collection('discord-data')
      .doc('events')
      .collection('studyEvents')
      .doc(eventId)
      .set(event);

    return event;
  }

  /**
   * Gets an event by ID
   */
  async getEvent(eventId: string): Promise<StudyEvent | null> {
    const doc = await this.db
      .collection('discord-data')
      .doc('events')
      .collection('studyEvents')
      .doc(eventId)
      .get();

    if (!doc.exists) {
      return null;
    }

    return doc.data() as StudyEvent;
  }

  /**
   * Gets all upcoming events for a server (not cancelled, start time in future)
   */
  async getUpcomingEvents(serverId: string): Promise<StudyEvent[]> {
    const now = Timestamp.now();

    const snapshot = await this.db
      .collection('discord-data')
      .doc('events')
      .collection('studyEvents')
      .where('serverId', '==', serverId)
      .where('startTime', '>', now)
      .orderBy('startTime', 'asc')
      .get();

    if (snapshot.empty) {
      return [];
    }

    return snapshot.docs
      .map((doc) => doc.data() as StudyEvent)
      .filter((event) => !event.isCancelled);
  }

  /**
   * Gets events the user has RSVP'd to
   */
  async getUserEvents(userId: string, serverId: string): Promise<StudyEvent[]> {
    const now = Timestamp.now();

    const snapshot = await this.db
      .collection('discord-data')
      .doc('events')
      .collection('studyEvents')
      .where('serverId', '==', serverId)
      .where('startTime', '>', now)
      .orderBy('startTime', 'asc')
      .get();

    if (snapshot.empty) {
      return [];
    }

    return snapshot.docs
      .map((doc) => doc.data() as StudyEvent)
      .filter(
        (event) =>
          !event.isCancelled &&
          event.attendees.some((attendee) => attendee.userId === userId)
      );
  }

  /**
   * Adds a user to an event's attendee list
   */
  async joinEvent(
    eventId: string,
    userId: string,
    username: string
  ): Promise<{ success: boolean; message: string }> {
    const event = await this.getEvent(eventId);

    if (!event) {
      return { success: false, message: 'Event not found.' };
    }

    if (event.isCancelled) {
      return { success: false, message: 'This event has been cancelled.' };
    }

    // Check if already joined
    if (event.attendees.some((attendee) => attendee.userId === userId)) {
      return { success: false, message: 'You have already joined this event.' };
    }

    // Check if event is full
    if (event.maxAttendees && event.attendees.length >= event.maxAttendees) {
      return { success: false, message: 'This event is full.' };
    }

    // Check if event has already started
    const now = Timestamp.now();
    if (event.startTime.toMillis() <= now.toMillis()) {
      return { success: false, message: 'This event has already started.' };
    }

    // Add user to attendees
    await this.db
      .collection('discord-data')
      .doc('events')
      .collection('studyEvents')
      .doc(eventId)
      .update({
        attendees: FieldValue.arrayUnion({
          userId,
          username,
          joinedAt: Timestamp.now(),
        }),
      });

    return { success: true, message: 'Successfully joined the event!' };
  }

  /**
   * Removes a user from an event's attendee list
   */
  async leaveEvent(
    eventId: string,
    userId: string
  ): Promise<{ success: boolean; message: string }> {
    const event = await this.getEvent(eventId);

    if (!event) {
      return { success: false, message: 'Event not found.' };
    }

    // Check if user is the creator
    if (event.creatorId === userId) {
      return {
        success: false,
        message: 'Event creators cannot leave their own event. Use /cancelevent to cancel it.',
      };
    }

    // Find the user in attendees
    const attendee = event.attendees.find((a) => a.userId === userId);
    if (!attendee) {
      return { success: false, message: 'You are not registered for this event.' };
    }

    // Remove user from attendees
    await this.db
      .collection('discord-data')
      .doc('events')
      .collection('studyEvents')
      .doc(eventId)
      .update({
        attendees: FieldValue.arrayRemove(attendee),
      });

    return { success: true, message: 'Successfully left the event.' };
  }

  /**
   * Cancels an event (only by creator)
   */
  async cancelEvent(
    eventId: string,
    userId: string
  ): Promise<{ success: boolean; message: string }> {
    const event = await this.getEvent(eventId);

    if (!event) {
      return { success: false, message: 'Event not found.' };
    }

    if (event.creatorId !== userId) {
      return { success: false, message: 'Only the event creator can cancel this event.' };
    }

    if (event.isCancelled) {
      return { success: false, message: 'This event is already cancelled.' };
    }

    await this.db
      .collection('discord-data')
      .doc('events')
      .collection('studyEvents')
      .doc(eventId)
      .update({
        isCancelled: true,
        cancelledAt: Timestamp.now(),
      });

    return { success: true, message: 'Event cancelled successfully.' };
  }

  /**
   * Updates event message ID after posting to feed
   */
  async updateEventMessage(
    eventId: string,
    messageId: string,
    channelId: string
  ): Promise<void> {
    await this.db
      .collection('discord-data')
      .doc('events')
      .collection('studyEvents')
      .doc(eventId)
      .update({
        messageId,
        channelId,
      });
  }
}
