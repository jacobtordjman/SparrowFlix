// functions/db/connection.js - Using MongoDB Data API for Cloudflare Workers
export class MongoDBDataAPI {
  constructor(env) {
    this.apiUrl = `https://data.mongodb-api.com/app/${env.MONGODB_APP_ID}/endpoint/data/v1`;
    this.apiKey = env.MONGODB_API_KEY;
    this.dataSource = env.MONGODB_DATA_SOURCE || 'Cluster0';
    this.database = env.MONGODB_DATABASE || 'sparrowflix';
  }

  async request(action, collection, data = {}) {
    const response = await fetch(`${this.apiUrl}/action/${action}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': this.apiKey,
      },
      body: JSON.stringify({
        dataSource: this.dataSource,
        database: this.database,
        collection: collection,
        ...data
      })
    });

    if (!response.ok) {
      throw new Error(`MongoDB API error: ${response.status}`);
    }

    return await response.json();
  }

  collection(name) {
    return {
      findOne: async (filter) => {
        const result = await this.request('findOne', name, { filter });
        return result.document;
      },
      
      find: async (filter = {}, options = {}) => {
        const result = await this.request('find', name, {
          filter,
          limit: options.limit || 50,
          sort: options.sort || {}
        });
        return {
          toArray: async () => result.documents || []
        };
      },
      
      insertOne: async (document) => {
        return await this.request('insertOne', name, { document });
      },
      
      updateOne: async (filter, update, options = {}) => {
        return await this.request('updateOne', name, {
          filter,
          update,
          upsert: options.upsert || false
        });
      },
      
      deleteOne: async (filter) => {
        return await this.request('deleteOne', name, { filter });
      },
      
      aggregate: async (pipeline) => {
        const result = await this.request('aggregate', name, { pipeline });
        return result.documents || [];
      }
    };
  }
}

export async function connectDB(env) {
  return new MongoDBDataAPI(env);
}