import * as puppeteer from 'puppeteer';
import * as chalk from 'chalk';
import { sleep } from '@cops-database/utils';

import * as Airtable from 'airtable';

import { chunk } from 'lodash';
import * as config from 'config';

const base = new Airtable({ apiKey: config.get('airtable.secretToken') }).base(
  'appH0D66qIF4fVMtu'
);

type AirtableRecord = {
  fields: {
    name: string;
    type: string;
    link: string;
    location: string;
    ['source page number']: number;
  };
};

const scraper = async () => {
  try {
    await base('officers').find('recMm1CXH3D55YQrI');
  } catch (e) {
    console.error(
      chalk.red(
        'Could not connect to officers table in Airtable:',
        e.message,
        e.stack
      )
    );
    process.exit(1);
  }

  console.log(chalk.green.underline('starting scraper...'));
  const browser = await puppeteer.launch({});
  const page = await browser.newPage();
  await page.setExtraHTTPHeaders({
    ['x-requested-with']: 'XMLHttpRequest',
  });

  const getDataFromPage = async (pageNumber: number) => {
    console.log(chalk.green.underline('opening page...'), pageNumber);
    await sleep(0.5);
    await page.goto(
      `https://www.policeone.com/law-enforcement-directory/search/page-${pageNumber}`,
      { waitUntil: 'domcontentloaded' }
    );
    console.log(chalk.green.underline('pulling data...'), pageNumber);
    const rows = await page.$$('.Table-row:not([data-load-more-target])');

    const data = await rows.reduce<Promise<AirtableRecord[]>>(
      async (acc, row) => {
        const prev = await acc;
        const getTextFrom = async (
          selector: string,
          prop = 'textContent',
          fromRow = false
        ) => {
          if (fromRow) {
            const el = await row.getProperty(prop);
            return (await el.jsonValue()) as string;
          }
          const el = await row.$(selector);
          if (!el) {
            return '';
          }
          const textProp = await el.getProperty(prop);
          const val = await textProp.jsonValue();
          return val as string;
        };
        const agencyName = await getTextFrom(
          '.Table-cell:nth-child(1) .Table-link'
        );
        const agencyType = await getTextFrom(
          '.Table-cell:nth-child(2) .Table-cellContent'
        );
        const agencyLocation = await getTextFrom(
          '.Table-cell:nth-child(3) .Table-cellContent'
        );
        const agencyLink = await getTextFrom('a', 'href', true);
        const mappedRecord: AirtableRecord = {
          fields: {
            name: agencyName || '',
            type: agencyType || '',
            link: agencyLink || '',
            location: agencyLocation || '',
            ['source page number']: pageNumber,
          },
        };
        return [...prev, mappedRecord];
      },
      Promise.resolve([])
    );

    console.log(
      chalk.green.underline(
        'writing',
        rows.length,
        'rows to airtable... for page',
        pageNumber
      )
    );

    // Airtable only allows ten rows to be created at a time:
    await chunk(data, 10).reduce<Promise<void>>(
      async (acc: Promise<void>, chunkOfData: AirtableRecord[]) => {
        await acc;
        await sleep(1 / 4);

        try {
          await base('local agencies').create(chunkOfData);
        } catch (e) {
          console.log(
            chalk.red.underline('failed to sync agency:', e.message),
            'in page',
            pageNumber
          );
        }
      },
      Promise.resolve()
    );

    console.log(
      chalk.green.underline('scraped', rows.length, 'rows', 'from page'),
      pageNumber
    );
  };

  await Array.from({ length: 550 }).reduce(
    async (acc, rec, pageNumber: number) => {
      await acc;
      await getDataFromPage(pageNumber + 1);
    },
    Promise.resolve()
  );

  process.on('beforeExit', async () => {
    try {
      await browser.close();
      // eslint-disable-next-line no-empty
    } catch (e) {}
  });
  try {
    await browser.close();
    // eslint-disable-next-line no-empty
  } catch (e) {}
  console.log(chalk.green.underline('scraper finished.'));
};

export default scraper;
