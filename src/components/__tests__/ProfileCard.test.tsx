/**
 * Unit tests for ProfileCard Component
 *
 * Tests the profile card rendering including:
 * - Username display and truncation
 * - Level progress bar calculation
 * - Group info display with shield colors
 * - Stats grid rendering
 * - XP calculation logic
 *
 * Run with: npm test -- ProfileCard.test.tsx
 */

import React from 'react';
import { ProfileCard } from '../ProfileCard';
import * as xpUtils from '../../utils/xp';

// Mock the xp utility functions
jest.mock('../../utils/xp', () => ({
  xpForLevel: jest.fn(),
  levelProgress: jest.fn(),
  calculateLevel: jest.fn(),
  xpToNextLevel: jest.fn(),
  awardXP: jest.fn(),
}));

// Mock lucide-react icons to avoid import issues in test environment
jest.mock('lucide-react', () => ({
  Flame: () => <div data-testid="flame-icon" />,
  Zap: () => <div data-testid="zap-icon" />,
  Award: () => <div data-testid="award-icon" />,
  BookOpen: () => <div data-testid="bookopen-icon" />,
  Timer: () => <div data-testid="timer-icon" />,
  User: () => <div data-testid="user-icon" />,
  Shield: () => <div data-testid="shield-icon" />,
}));

describe('ProfileCard', () => {
  const defaultProps = {
    username: 'TestUser',
    streak: 5,
    xp: 1000,
    level: 10,
    totalSessions: 25,
    achievementCount: 8,
    longestStreak: 10,
    totalHours: 50,
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Set up default mock implementations
    (xpUtils.xpForLevel as jest.Mock).mockImplementation((level: number) => {
      if (level === 10) return 800;
      if (level === 11) return 1200;
      return 0;
    });

    (xpUtils.levelProgress as jest.Mock).mockReturnValue(50);
  });

  describe('Basic Rendering', () => {
    it('should render username correctly', () => {
      const { container } = renderToString(<ProfileCard {...defaultProps} />);

      expect(container).toContain('TestUser');
    });

    it('should truncate long usernames to 10 characters', () => {
      const longUsername = 'VeryLongUsername123';
      const { container } = renderToString(<ProfileCard {...defaultProps} username={longUsername} />);

      expect(container).toContain('VeryLongUs...');
      expect(container).not.toContain(longUsername);
    });

    it('should not truncate usernames with 10 or fewer characters', () => {
      const shortUsername = 'Short';
      const { container } = renderToString(<ProfileCard {...defaultProps} username={shortUsername} />);

      expect(container).toContain('Short');
      expect(container).not.toContain('...');
    });

    it('should display level correctly', () => {
      const { container } = renderToString(<ProfileCard {...defaultProps} level={15} />);

      expect(container).toContain('Level 15');
    });
  });

  describe('XP Progress Bar', () => {
    it('should calculate XP in current level correctly', () => {
      const { container } = renderToString(<ProfileCard {...defaultProps} />);

      // Current XP: 1000, Level 10 XP: 800 = 200 XP in current level
      expect(xpUtils.xpForLevel).toHaveBeenCalledWith(10);
      expect(xpUtils.xpForLevel).toHaveBeenCalledWith(11);
    });

    it('should display XP progress with correct values', () => {
      const { container } = renderToString(<ProfileCard {...defaultProps} />);

      // xpInCurrentLevel = 1000 - 800 = 200
      // xpNeededForNextLevel = 1200 - 800 = 400
      expect(container).toContain('200 / 400 XP');
    });

    it('should use levelProgress utility for progress bar width', () => {
      (xpUtils.levelProgress as jest.Mock).mockReturnValue(75);

      renderToString(<ProfileCard {...defaultProps} />);

      expect(xpUtils.levelProgress).toHaveBeenCalledWith(1000);
    });
  });

  describe('Stats Display', () => {
    it('should display total XP with proper formatting', () => {
      const { container } = renderToString(<ProfileCard {...defaultProps} xp={12500} />);

      expect(container).toContain('12,500'); // Should have comma separator
      expect(container).toContain('Total XP');
    });

    it('should display total hours', () => {
      const { container } = renderToString(<ProfileCard {...defaultProps} totalHours={125} />);

      expect(container).toContain('125h');
      expect(container).toContain('Total time');
    });

    it('should display total sessions', () => {
      const { container } = renderToString(<ProfileCard {...defaultProps} totalSessions={42} />);

      expect(container).toContain('42');
      expect(container).toContain('Sessions');
    });

    it('should display achievement count', () => {
      const { container } = renderToString(<ProfileCard {...defaultProps} achievementCount={15} />);

      expect(container).toContain('15');
      expect(container).toContain('Achievements');
    });

    it('should display current streak', () => {
      const { container } = renderToString(<ProfileCard {...defaultProps} streak={7} />);

      expect(container).toContain('7');
      expect(container).toContain('Day streak');
    });

    it('should display longest streak', () => {
      const { container } = renderToString(<ProfileCard {...defaultProps} longestStreak={14} />);

      expect(container).toContain('14');
      expect(container).toContain('Best streak');
    });
  });

  describe('Group Information', () => {
    it('should not display group info when not provided', () => {
      const { container } = renderToString(<ProfileCard {...defaultProps} />);

      expect(container).not.toContain('text-testid="shield-icon"');
    });

    it('should display group name and level when provided', () => {
      const { container } = renderToString(
        <ProfileCard
          {...defaultProps}
          groupName="Elite Learners"
          groupId="GP-TEST"
          groupLevel={15}
        />
      );

      expect(container).toContain('Elite Learners');
      expect(container).toContain('15'); // Group level inside shield
    });

    it('should use bronze shield color for low level groups (1-10)', () => {
      const { container } = renderToString(
        <ProfileCard
          {...defaultProps}
          groupName="Beginners"
          groupLevel={5}
        />
      );

      expect(container).toContain('text-[#CD7F32]'); // Bronze color
    });

    it('should use silver shield color for level 11-20 groups', () => {
      const { container } = renderToString(
        <ProfileCard
          {...defaultProps}
          groupName="Intermediates"
          groupLevel={15}
        />
      );

      expect(container).toContain('text-[#C0C0C0]'); // Silver color
    });

    it('should use gold shield color for level 21-30 groups', () => {
      const { container } = renderToString(
        <ProfileCard
          {...defaultProps}
          groupName="Advanced"
          groupLevel={25}
        />
      );

      expect(container).toContain('text-[#FFD700]'); // Gold color
    });

    it('should use platinum shield color for level 31-40 groups', () => {
      const { container } = renderToString(
        <ProfileCard
          {...defaultProps}
          groupName="Elite"
          groupLevel={35}
        />
      );

      expect(container).toContain('text-[#00CED1]'); // Platinum color
    });

    it('should use diamond shield color for level 41+ groups', () => {
      const { container } = renderToString(
        <ProfileCard
          {...defaultProps}
          groupName="Legends"
          groupLevel={50}
        />
      );

      expect(container).toContain('text-[#B9F2FF]'); // Diamond color
    });

    it('should default to bronze when group level is not provided', () => {
      const { container } = renderToString(
        <ProfileCard
          {...defaultProps}
          groupName="Test Group"
        />
      );

      expect(container).toContain('text-[#CD7F32]'); // Bronze color
    });
  });

  describe('Avatar Display', () => {
    it('should display avatar image when avatarUrl is provided', () => {
      const avatarUrl = 'https://cdn.discordapp.com/avatars/123/abc.png';
      const { container } = renderToString(
        <ProfileCard {...defaultProps} avatarUrl={avatarUrl} />
      );

      expect(container).toContain(avatarUrl);
      expect(container).toContain('img');
    });

    it('should display User icon when avatarUrl is not provided', () => {
      const { container } = renderToString(<ProfileCard {...defaultProps} />);

      expect(container).toContain('data-testid="user-icon"');
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero values correctly', () => {
      const { container } = renderToString(
        <ProfileCard
          {...defaultProps}
          streak={0}
          xp={0}
          totalSessions={0}
          achievementCount={0}
          longestStreak={0}
          totalHours={0}
        />
      );

      expect(container).toContain('0');
    });

    it('should handle very large XP values with formatting', () => {
      const { container } = renderToString(
        <ProfileCard {...defaultProps} xp={1234567} />
      );

      expect(container).toContain('1,234,567');
    });

    it('should handle level 1 correctly', () => {
      (xpUtils.xpForLevel as jest.Mock).mockImplementation((level: number) => {
        if (level === 1) return 0;
        if (level === 2) return 100;
        return 0;
      });

      const { container } = renderToString(
        <ProfileCard {...defaultProps} level={1} xp={50} />
      );

      expect(container).toContain('Level 1');
    });

    it('should handle max level (100) correctly', () => {
      (xpUtils.xpForLevel as jest.Mock).mockImplementation((level: number) => {
        if (level === 100) return 100000;
        if (level === 101) return 100000; // Same XP for next level
        return 0;
      });

      const { container } = renderToString(
        <ProfileCard {...defaultProps} level={100} xp={100000} />
      );

      expect(container).toContain('Level 100');
    });
  });

  describe('Component Structure', () => {
    it('should render all stat cards', () => {
      const { container } = renderToString(<ProfileCard {...defaultProps} />);

      // Check for all stat labels
      expect(container).toContain('Total XP');
      expect(container).toContain('Total time');
      expect(container).toContain('Sessions');
      expect(container).toContain('Achievements');
      expect(container).toContain('Day streak');
      expect(container).toContain('Best streak');
    });

    it('should have correct container dimensions', () => {
      const { container } = renderToString(<ProfileCard {...defaultProps} />);

      expect(container).toContain('w-[700px]');
      expect(container).toContain('h-[650px]');
    });

    it('should use dark theme colors', () => {
      const { container } = renderToString(<ProfileCard {...defaultProps} />);

      expect(container).toContain('bg-[#131F24]'); // Main background
      expect(container).toContain('bg-[#1F2B31]'); // Card backgrounds
    });
  });
});

/**
 * Helper function to render React component to string for testing
 * Since we're not using a DOM environment, we'll just render to string
 */
function renderToString(component: React.ReactElement): { container: string } {
  // Create a simple renderer that converts the component tree to a searchable string
  const renderElement = (element: any): string => {
    if (!element) return '';
    if (typeof element === 'string' || typeof element === 'number') {
      return String(element);
    }
    if (Array.isArray(element)) {
      return element.map(renderElement).join('');
    }
    if (element.type && element.props) {
      const { children, className, style, src, alt, ...otherProps } = element.props;
      let result = '';

      // Add classNames for testing
      if (className) result += ` ${className} `;

      // Add styles for testing
      if (style) {
        result += ` style="${JSON.stringify(style)}" `;
      }

      // Add src and alt for images
      if (src) result += ` src="${src}" `;
      if (alt) result += ` alt="${alt}" `;

      // Add other props
      Object.keys(otherProps).forEach(key => {
        const value = otherProps[key];
        if (value !== undefined && value !== null) {
          result += ` ${key}="${value}" `;
        }
      });

      // Add element type for identification
      if (typeof element.type === 'string') {
        result += ` ${element.type} `;
      }

      // Recursively render children
      if (children) {
        if (Array.isArray(children)) {
          result += children.map(renderElement).join('');
        } else {
          result += renderElement(children);
        }
      }

      return result;
    }
    return '';
  };

  return {
    container: renderElement(component),
  };
}
