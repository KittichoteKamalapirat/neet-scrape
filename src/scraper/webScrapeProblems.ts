import puppeteer, { Browser, Page } from 'puppeteer';
import * as fs from 'fs';
import * as path from 'path';
import { repeatStringsByFrequency } from './util/repeatStringsByFrequency';

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
        .filter(Boolean) as any,
  );

  return { categories, categoryCount };
};

interface Problem {
  category: string | null;
  href: string | null;
  text: string | null;
  difficulty: string | null;
  isPremium: boolean;
  question: string;
}

export const scrapeProblemsFromTab = async (
  page: Page,
  tabIndex: number,
): Promise<Problem[]> => {
  await page.goto(url); // Ensure you are at the starting URL
  const tabLinks = await page.$$(
    'div.tabs.is-centered.is-boxed.is-large ul.tabs-list li a.tab-link',
  );
  await tabLinks[tabIndex].click();
  await addDelay(3000);

  // change view
  const videoModalSelector =
    'button.button.navbar-btn.is-rounded.is-info.is-outlined.has-tooltip-bottom';
  page.waitForSelector(videoModalSelector);
  await page.click(videoModalSelector);
  const rows = await page.$$('tr.ng-star-inserted');
  const problems: Problem[] = [];

  await page.waitForSelector('app-pattern-table', { timeout: 1000 });

  const accordionHeaders = await page.$$eval(
    'app-pattern-table',
    (tables: Element[]) =>
      tables.map((table) => {
        const text = table
          .querySelector('button')
          ?.textContent?.trim() as string;
        const indexOfOpenParenthesis = text?.indexOf('(');
        return text.slice(0, indexOfOpenParenthesis);
      }),
  );

  const categoryTrCounts = await page.$$eval(
    'app-pattern-table',
    (tables: Element[]) =>
      tables.map((table) => table.querySelectorAll('tr').length - 1),
  );

  const categories = repeatStringsByFrequency(
    accordionHeaders,
    categoryTrCounts,
  );
  // Log the total count of categories and the count of tr elements in each category

  let current = 0;
  let counter = current;
  let batchSize = 1;
  for (const row of rows.slice(current, current + batchSize)) {
    const anchor = await row.$('td a.table-text');
    const isPremiumElement = await row.$(
      'td a.has-tooltip-bottom.ng-star-inserted',
    );
    // const videoModalButton = await row.$()
    page.click(
      'button.button.navbar-btn.video-icon.is-rounded.is-outlined.ng-star-inserted',
    );
    const difficultyElement = await row.$('td.diff-col b');
    const container = await row.$('.accordion-container');
    const categoryElement = container
      ? await container.$(
          'button.flex-container-row.accordion.button.is-fullwidth p',
        )
      : null;

    const href = anchor
      ? await (await anchor.getProperty('href')).jsonValue()
      : null;
    const text = anchor
      ? await (await anchor.getProperty('textContent')).jsonValue()
      : null;
    const category = categoryElement
      ? await (await categoryElement.getProperty('textContent')).jsonValue()
      : null;
    const difficulty = difficultyElement
      ? await (await difficultyElement.getProperty('textContent')).jsonValue()
      : null;
    const isPremium = !!isPremiumElement;

    let content = null;
    if (href) {
      const detailPage = await page.browser().newPage();
      await detailPage.goto(href + 'description');
      await detailPage.waitForSelector('div[class="elfjS"]'); // need to wait, otherwise can't find
      content = await detailPage.$eval(
        // content__u3I1 question-content__JfgR
        // data-layout-path="/ts0"
        // 'div[data-layout-path="/ts0"]',
        'div[class="elfjS"]',
        (div: Element) => div.outerHTML.replace(/[\r\n]+/g, ' '),
      );
      await detailPage.close();
    }

    problems.push({
      category: categories[counter],
      href,
      text: text?.trim() || '',
      difficulty: difficulty?.trim() || '',
      isPremium,
      question: content as string,
    });
    console.log('counter', counter);
    counter += 1;
  }
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
  const delimitor = '|';
  const headers = `DSA${delimitor}Title${delimitor}Level${delimitor}Question\n`;

  // Map each problem object to a CSV row
  const rows = problems
    .map((problem) => {
      return `${problem.category}${delimitor}${problem.text}${delimitor}${problem.difficulty}${delimitor}${problem.question}`;
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
