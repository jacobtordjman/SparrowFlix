// functions/db/connection.js - Cloudflare Workers compatible version
// Option 1: Use MongoDB Atlas Data API (Recommended)

export async function connectDB(env) {
  // Use MongoDB Atlas Data API instead of direct connection
  const mongoAPI = {
    baseUrl: `https://data.mongodb-api.com/app/${env.MONGODB_APP_ID}/endpoint/data/v1`,
    headers: {
      'Content-Type': 'application/json',
      'api-key': env.MONGODB_API_KEY
    },
    
    async find(collection, filter = {}, options = {}) {
      const response = await fetch(`${this.baseUrl}/action/find`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({
          collection,
          database: env.MONGODB_DATABASE || 'sparrowflix',
          filter,
          ...options
        })
      });
      const result = await response.json();
      return result.documents || [];
    },
    
    async findOne(collection, filter) {
      const response = await fetch(`${this.baseUrl}/action/findOne`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({
          collection,
          database: env.MONGODB_DATABASE || 'sparrowflix',
          filter
        })
      });
      const result = await response.json();
      return result.document;
    },
    
    async insertOne(collection, document) {
      const response = await fetch(`${this.baseUrl}/action/insertOne`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({
          collection,
          database: env.MONGODB_DATABASE || 'sparrowflix',
          document
        })
      });
      return await response.json();
    },
    
    async updateOne(collection, filter, update, options = {}) {
      const response = await fetch(`${this.baseUrl}/action/updateOne`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({
          collection,
          database: env.MONGODB_DATABASE || 'sparrowflix',
          filter,
          update,
          ...options
        })
      });
      return await response.json();
    },
    
    async deleteOne(collection, filter) {
      const response = await fetch(`${this.baseUrl}/action/deleteOne`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({
          collection,
          database: env.MONGODB_DATABASE || 'sparrowflix',
          filter
        })
      });
      return await response.json();
    },
    
    // Wrapper to match MongoDB driver API
    collection(name) {
      return {
        find: (filter, options) => ({
          toArray: () => this.find(name, filter, options),
          limit: (count) => ({
            toArray: () => this.find(name, filter, { ...options, limit: count })
          }),
          sort: (sortSpec) => ({
            toArray: () => this.find(name, filter, { ...options, sort: sortSpec }),
            limit: (count) => ({
              toArray: () => this.find(name, filter, { ...options, sort: sortSpec, limit: count })
            })
          })
        }),
        findOne: (filter) => this.findOne(name, filter),
        insertOne: (doc) => this.insertOne(name, doc),
        updateOne: (filter, update, options) => this.updateOne(name, filter, update, options),
        deleteOne: (filter) => this.deleteOne(name, filter),
        findOneAndUpdate: async (filter, update, options) => {
          const result = await this.updateOne(name, filter, update, options);
          if (options?.returnDocument === 'after') {
            return { value: await this.findOne(name, filter) };
          }
          return result;
        }
      };
    }
  };
  
  return mongoAPI;
}