import { Client } from "@notionhq/client"
import {
  DatabaseObjectResponse, MentionRichTextItemResponse, PageObjectResponse,
} from "@notionhq/client/build/src/api-endpoints"

import { config } from 'dotenv';
config();

const notion = new Client({ auth: process.env["NOTION_KEY"] })

// Types
type PagePropertiesRecordType = PageObjectResponse['properties'];
type PagePropertiesType = PagePropertiesRecordType[keyof PagePropertiesRecordType];
type RichTextType = Extract<PagePropertiesType, { type: 'rich_text' }>;

type PageMentionType = Extract<MentionRichTextItemResponse['mention'], { type: 'page' }>;

// --------------------------------------------------------------------------------------

async function main(){
  // Find the first database this bot has access to
  const databases = await notion.search({
    filter: {
      property: "object",
      value: "database",
    },
  })

  if (databases.results.length === 0) {
    throw new Error("This client doesn't have access to any databases!")
  }

  const results = databases.results as Array<DatabaseObjectResponse>;
  const prdbName = 'PRs';
  const prdb = results.find(db => db.title[0].plain_text === prdbName);

  if (!prdb) {
    throw new Error("PR database could not be found!")
  }

  const rowResponse = await notion.databases.query({
    database_id: prdb.id,
    filter: {
      property: "Name",
      rich_text: {
        equals: 'pr1',
      },
    },
  });

  const row = rowResponse.results[0] as PageObjectResponse;

  const linkedTaskProperty = row.properties.Task as RichTextType;
  const linkedTaskMention = linkedTaskProperty.rich_text[0] as MentionRichTextItemResponse;
  const linkedTaskPageId = (linkedTaskMention.mention as PageMentionType).page.id;

  // Set the PR to 'merged'
  notion.pages.update({
    page_id: row.id,
    properties: {
      'Status': {
        select: {
          name: "Merged",
        },
      },
    },
  });

  // Set the corresponding task to 'complete'
  notion.pages.update({
    page_id: linkedTaskPageId,
    properties: {
      'Status': {
        select: {
          name: "Completed",
        },
      },
    },
  });
};

main();
