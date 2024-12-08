import {DataAPIClient} from "@datastax/astra-db-ts"
import {PuppeteerWebBaseLoader} from "langchain/document_loaders/web/puppeteer"
import OpenAI from "openai"

import {RecursiveCharacterTextSplitter} from "langchain/text_splitter"

import "dotenv/config"

type SimilarityMetric= "dot_product" | "cosine" | "euclidean"

const {ASTRA_DB_NAMESPACE, ASTRA_DB_COLLECTION, ASTRA_DB_API_ENDPOINT, ASTRA_DB_APPLICATION_TOKEN, OPENAI_API_KEY } = process.env

const openai = new OpenAI({apiKey: OPENAI_API_KEY})

const f1Data = [
    'https://en.wikipedia.org/wiki/Formula_One',
    'https://www.formula1.com/en/latest',
    'https://www.motorsport.com/f1/news/',
    'https://www.skysports.com/f1',
    'https://www.bbc.com/sport/formula1',
    'https://www.planetf1.com/',
    'https://www.autosport.com/f1/',
    'https://www.gptoday.com/',
    'https://racingnews365.com/f1-news',
    'https://www.theguardian.com/sport/formulaone',
    'https://www.newsnow.co.uk/h/Sport/F1',
    'https://www.reuters.com/sports/formula1/'
]

const client = new DataAPIClient(ASTRA_DB_APPLICATION_TOKEN)
const db = client.db(ASTRA_DB_API_ENDPOINT, {namespace: ASTRA_DB_NAMESPACE}) 

const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 512,
    chunkOverlap: 100
})

const createCollection = async (similarityMetric: SimilarityMetric = "dot_product") => {
    const res = await db.createCollection(ASTRA_DB_COLLECTION, {
        vector: {
            dimension: 1536,
            metric: similarityMetric
        }
    })
    console.log(res)
}

const loadSampleData = async () => {
    const collection = await db.collection(ASTRA_DB_COLLECTION)
    for await ( const uel of f1Data) {
        const content = await scrapePage(url)
        const chunks = await splitter.splitText(content)
        for await (const chunk of chunks){
            const embedding = await openai.embeddings.create({
                model: "text-embedding-3-small",
            input:chunk,
            encoding_format: "float"
            })

            const vector = embedding.data[0].embedding

            const res = await collection.insertOne({
                $vector: vector,
                text: chunk
            })
            console.log(res)
        }
    }
}

const scrapePage = async (url: string) => {
    const loader = new PuppeteerWebBaseLoader(url,{
        launchOptions: {
            headless: true
        },
        gotoOptions: {
            waitUntil: "domcontentloaded"
        },
        evaluate: async (page, browser) => {
            const result = await page.evaluate(() => document.body.innerHTML)
            await browser.close()
            return result
        }
    })
    return ( await loader.scrape())?.repalce(/<[^>]*>?/gm, ' ')
}

createCollection().then(() => loadSampleData())