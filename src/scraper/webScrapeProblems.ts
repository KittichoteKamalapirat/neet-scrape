import puppeteer, { Browser, Page } from 'puppeteer';
import * as fs from 'fs';
import * as path from 'path';

const url = 'https://neetcode.io/practice/';

// This function will add a delay to the code execution (in milliseconds)
const addDelay = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

interface BrowserPage {
  browser: Browser;
  page: Page;
}

export const initiatePuppeteer = async (): Promise<BrowserPage> => {
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
  });
  const page = await browser.newPage();
  await page.goto(url);
  return { browser, page };
};

interface ScrapeCategoriesResult {
  categories: string[];
  categoryCount: number;
}

export const scrapeCategories = async (
  page: Page,
): Promise<ScrapeCategoriesResult> => {
  const tabLinks = await page.$$(
    'div.tabs.is-centered.is-boxed.is-large ul.tabs-list li a.tab-link',
  );
  await tabLinks[2].click();
  await page.waitForSelector('app-pattern-table', { timeout: 1000 });
  await page.waitForSelector(
    'button.flex-container-row.accordion.button.is-fullwidth.ng-tns-c41-0',
    { timeout: 1000 },
  );

  const categoryCount = await page.$$eval(
    'app-pattern-table',
    (categories: Element[]) => categories.length,
  );

  for (let i = 0; i < categoryCount; i++) {
    const selector = `button.flex-container-row.accordion.button.is-fullwidth.ng-tns-c41-${i}`;
    await page.waitForSelector(selector);
    await addDelay(750);
    await page.click(selector);
  }

  const categories = await page.$$eval(
    'button.flex-container-row.accordion.button.is-fullwidth.active',
    (buttons: Element[]) =>
      buttons
        .map((button) => {
          const paragraph = button.querySelector('p');
          return paragraph ? paragraph.textContent?.trim() ?? null : null;
        })
        .filter(Boolean),
  );

  return { categories, categoryCount };
};

interface Problem {
  category: string | null;
  href: string | null;
  text: string | null;
  difficulty: string | null;
  isPremium: boolean;
}

export const scrapeProblemsFromTab = async (
  page: Page,
  tabIndex: number,
): Promise<Problem[]> => {
  const tabLinks = await page.$$(
    'div.tabs.is-centered.is-boxed.is-large ul.tabs-list li a.tab-link',
  );
  await tabLinks[tabIndex].click();
  await page.waitForTimeout(3000);
  const problems = await page.$$eval(
    'tr.ng-star-inserted',
    (rows: Element[]) => {
      return rows.map((row) => {
        const anchor = row.querySelector('td a.table-text');
        const isPremium = row.querySelector(
          'td a.has-tooltip-bottom.ng-star-inserted',
        );
        const difficultyElement = row.querySelector('td.diff-col b');
        const container = row.closest('.accordion-container');
        const categoryElement = container
          ? container.querySelector(
              'button.flex-container-row.accordion.button.is-fullwidth.active p',
            )
          : null;
        return {
          category: categoryElement
            ? categoryElement.textContent?.trim() ?? null
            : null,
          href: anchor ? anchor.getAttribute('href') : null,
          text: anchor ? anchor.textContent?.trim() ?? null : null,
          difficulty: difficultyElement
            ? difficultyElement.textContent?.trim() ?? null
            : null,
          isPremium: !!isPremium,
        };
      });
    },
  );
  return problems;
};

export const saveProblemstoJSON = (
  filename: string,
  dirLocation: string,
  data: any,
): void => {
  const directory = path.join(__dirname, dirLocation);
  console.log(`Trying to save data to ${dirLocation}/${filename}`);
  try {
    if (!fs.existsSync(directory)) {
      console.log(`Directory ${directory} doesn't exist. Creating now.`);
      fs.mkdirSync(directory, { recursive: true });
    }
  } catch (err) {
    console.error(err);
  }
  try {
    fs.writeFileSync(
      path.join(directory, filename),
      JSON.stringify(data, null, 2),
      'utf-8',
    );
  } catch (err) {
    console.error(err);
  }
  console.log(`Data saved to ${directory}`);
};

export const convertToCSV = (problems: Problem[]): string => {
  // Create CSV headers
  const headers = 'Category,Link,Text,Difficulty,IsPremium\n';

  // Map each problem object to a CSV row
  const rows = problems
    .map((problem) => {
      return `${problem.category},${problem.href},${problem.text},${problem.difficulty},${problem.isPremium}`;
    })
    .join('\n');

  return headers + rows;
};

export const saveProblemsToCSV = (
  filename: string,
  dirLocation: string,
  problems: Problem[],
): void => {
  const csvData = convertToCSV(problems);
  const directory = path.join(__dirname, dirLocation);

  console.log(`Trying to save data to ${dirLocation}/${filename}`);
  try {
    // Ensure the directory exists
    if (!fs.existsSync(directory)) {
      console.log(`Directory ${directory} doesn't exist. Creating now.`);
      fs.mkdirSync(directory, { recursive: true });
    }
    // Write CSV data to the file
    fs.writeFileSync(path.join(directory, filename), csvData, 'utf-8');
    console.log(`Data saved to ${directory}/${filename}`);
  } catch (err) {
    console.error(`Error saving data: ${err}`);
  }
};
