// Adjust the import path according to your project structure

import {
  initiatePuppeteer,
  saveProblemsToCSV,
  saveProblemstoJSON,
  scrapeCategories,
  scrapeProblemsFromTab,
} from './webScrapeProblems';

export const main = async () => {
  try {
    const { page, browser } = await initiatePuppeteer();

    // const { categories, categoryCount } = await scrapeCategories(page);
    // console.log(`Scraped ${categoryCount} categories:`, categories);

    // Example of scraping problems from a specific tab index
    const problems = await scrapeProblemsFromTab(page, 2); // assuming tab index 2 is of interest
    console.log(`Scraped problems from tab 2:`, problems);

    // Saving scraped data to JSON file
    await saveProblemsToCSV('problems.csv', './data', problems);

    await browser.close();
  } catch (error) {
    console.error('Failed to run web scraper:', error);
  }
};
