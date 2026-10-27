import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import {
  enableSite,
  launchExtension,
  openCommands,
  openFixture,
  openInactivePopup,
  type Session,
} from './helpers';

type MotionIssue = { target: string; reason: string };

async function motionIssues(page: Page): Promise<MotionIssue[]> {
  return page.evaluate(() => {
    const parseTimes = (value: string): number[] =>
      value.split(',').map((part) => {
        const trimmed = part.trim();
        const amount = Number.parseFloat(trimmed);
        if (Number.isNaN(amount)) return 0;
        return trimmed.endsWith('ms') ? amount : amount * 1000;
      });

    const describe = (element: Element): string => {
      const id = element.id ? `#${element.id}` : '';
      const className =
        typeof element.className === 'string' && element.className.trim()
          ? `.${element.className.trim().split(/\s+/).join('.')}`
          : '';
      return `${element.tagName.toLowerCase()}${id}${className}`;
    };

    const issues: MotionIssue[] = [];
    for (const element of Array.from(document.querySelectorAll('*'))) {
      const style = getComputedStyle(element);
      const transitionDurations = parseTimes(style.transitionDuration);
      const longestTransition = Math.max(0, ...transitionDurations);
      if (longestTransition > 0) {
        const properties = style.transitionProperty.split(',').map((part) => part.trim());
        if (properties.includes('all')) {
          issues.push({ target: describe(element), reason: 'transitions all properties' });
        }
        if (longestTransition > 300) {
          issues.push({
            target: describe(element),
            reason: `transition lasts ${longestTransition}ms`,
          });
        }
      }

      const animations = style.animationName.split(',').map((part) => part.trim());
      const longestAnimation = Math.max(0, ...parseTimes(style.animationDuration));
      if (animations.some((name) => name !== 'none') && longestAnimation > 300) {
        issues.push({
          target: describe(element),
          reason: `animation lasts ${longestAnimation}ms`,
        });
      }
    }
    return issues;
  });
}

async function pressAndReadTransform(page: Page, selector: string): Promise<string> {
  const element = page.locator(selector).first();
  await element.scrollIntoViewIfNeeded();
  const box = await element.boundingBox();
  if (!box) throw new Error(`No bounding box for ${selector}`);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(180);
  const transform = await element.evaluate((node) => getComputedStyle(node).transform);
  await page.mouse.move(0, 0);
  await page.mouse.up();
  return transform;
}

test.describe('design rules', () => {
  let session: Session;
  let commands: Page;
  let tabId: number;

  test.beforeEach(async () => {
    session = await launchExtension();
    await openFixture(session.context);
    commands = await openCommands(session.context, session.extensionId);
    tabId = await enableSite(commands, session.worker);
  });

  test.afterEach(async () => {
    await session.dispose();
  });

  test('motion uses explicit properties and UI durations stay under 300ms', async () => {
    expect(await motionIssues(commands)).toEqual([]);
    const popup = await openInactivePopup(session, tabId);
    expect(await motionIssues(popup)).toEqual([]);
  });

  test('pressable controls give immediate press feedback', async () => {
    const buttonTransform = await pressAndReadTransform(commands, '.btn');
    expect(buttonTransform).toMatch(/matrix\(0\.97/);

    await commands.locator('#tab-sites').click();
    const switchTransform = await pressAndReadTransform(commands, '.switch-track');
    expect(switchTransform).toMatch(/matrix\(0\.96/);
  });

  test('hover styling is limited to fine pointers', async () => {
    const button = commands.locator('.btn-quiet').first();
    await button.hover();
    await commands.waitForTimeout(220);
    const hovered = await button.evaluate((node) => getComputedStyle(node).backgroundColor);
    expect(hovered).not.toBe('rgba(0, 0, 0, 0)');

    const unscopedHoverRules = await commands.evaluate(() => {
      const issues: string[] = [];
      const walk = (rules: CSSRuleList, hoverScoped: boolean): void => {
        for (const rule of Array.from(rules)) {
          if (rule instanceof CSSMediaRule) {
            const condition = rule.conditionText;
            const scoped =
              hoverScoped ||
              (/hover:\s*hover/.test(condition) && /pointer:\s*fine/.test(condition));
            walk(rule.cssRules, scoped);
            continue;
          }
          if (
            rule instanceof CSSStyleRule &&
            rule.selectorText.includes(':hover') &&
            !hoverScoped
          ) {
            issues.push(rule.selectorText);
          }
          if (rule instanceof CSSGroupingRule) walk(rule.cssRules, hoverScoped);
        }
      };
      for (const sheet of Array.from(document.styleSheets)) walk(sheet.cssRules, false);
      return issues;
    });
    expect(unscopedHoverRules).toEqual([]);
  });

  test('reduced motion keeps color transitions and removes movement', async () => {
    await commands.emulateMedia({ reducedMotion: 'reduce' });
    await commands.reload();
    await commands.waitForSelector('h1');

    const button = await commands.evaluate(() => {
      const element = document.querySelector('.btn');
      if (!element) throw new Error('Missing .btn');
      const style = getComputedStyle(element);
      return {
        reduced: matchMedia('(prefers-reduced-motion: reduce)').matches,
        properties: style.transitionProperty,
        duration: style.transitionDuration,
      };
    });

    expect(button.reduced).toBe(true);
    expect(button.properties).toContain('background-color');
    expect(button.properties).toContain('border-color');
    expect(button.properties).not.toContain('transform');
    expect(Number.parseFloat(button.duration)).toBeLessThanOrEqual(0.3);

    const buttonTransform = await pressAndReadTransform(commands, '.btn');
    expect(buttonTransform).toBe('none');

    await commands.locator('#tab-sites').click();
    const switchState = await commands.evaluate(() => {
      const read = (selector: string) => {
        const element = document.querySelector(selector);
        if (!element) throw new Error(`Missing ${selector}`);
        return getComputedStyle(element).transitionProperty;
      };
      return {
        knob: read('.switch-knob'),
        track: read('.switch-track'),
      };
    });
    expect(switchState.knob).not.toContain('transform');
    expect(switchState.track).not.toContain('transform');
  });
});
