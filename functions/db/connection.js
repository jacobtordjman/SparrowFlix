// functions/db/connection.js - MongoDB Atlas Data API for Cloudflare Workers
export async function connectDB(env) {
  // Validate required environment variables
  if (!env.MONGODB_APP_ID) {
    throw new Error('MONGODB_APP_ID is required');
  }
  if (!env.MONGODB_API_KEY) {
    throw new Error('MONGODB_API_KEY is required');
  }
  
  const mongoAPI = {
    baseUrl: `https://data.mongodb-api.com/app/${env.MONGODB_APP_ID}/endpoint/data/v1`,
    headers: {
      'Content-Type': 'application/json',
      'api-key': env.MONGODB_API_KEY
    },
    dataSource: env.MONGODB_DATA_SOURCE || 'Cluster0',
    database: env.MONGODB_DATABASE || 'sparrowflix',
    
    async find(collection, filter = {}, options = {}) {
      try {
        const response = await fetch(`${this.baseUrl}/action/find`, {
          method: 'POST',
          headers: this.headers,
          body: JSON.stringify({
            collection,
            database: this.database,
            dataSource: this.dataSource,
            filter,
            ...options
          })
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`MongoDB API error: ${response.status} ${response.statusText} - ${errorText}`);
        }
        
        const result = await response.json();
        return result.documents || [];
      } catch (error) {
        console.error('MongoDB find error:', error);
        throw error;
      }
    },
    
    async findOne(collection, filter) {
      try {
        const response = await fetch(`${this.baseUrl}/action/findOne`, {
          method: 'POST',
          headers: this.headers,
          body: JSON.stringify({
            collection,
            database: this.database,
            dataSource: this.dataSource,
            filter
          })
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`MongoDB API error: ${response.status} ${response.statusText} - ${errorText}`);
        }
        
        const result = await response.json();
        return result.document;
      } catch (error) {
        console.error('MongoDB findOne error:', error);
        throw error;
      }
    },
    
    async insertOne(collection, document) {
      try {
        const response = await fetch(`${this.baseUrl}/action/insertOne`, {
          method: 'POST',
          headers: this.headers,
          body: JSON.stringify({
            collection,
            database: this.database,
            dataSource: this.dataSource,
            document
          })
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`MongoDB API error: ${response.status} ${response.statusText} - ${errorText}`);
        }
        
        return await response.json();
      } catch (error) {
        console.error('MongoDB insertOne error:', error);
        throw error;
      }
    },
    
    async updateOne(collection, filter, update, options = {}) {
      try {
        const response = await fetch(`${this.baseUrl}/action/updateOne`, {
          method: 'POST',
          headers: this.headers,
          body: JSON.stringify({
            collection,
            database: this.database,
            dataSource: this.dataSource,
            filter,
            update,
            ...options
          })
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`MongoDB API error: ${response.status} ${response.statusText} - ${errorText}`);
        }
        
        return await response.json();
      } catch (error) {
        console.error('MongoDB updateOne error:', error);
        throw error;
      }
    },
    
    async deleteOne(collection, filter) {
      try {
        const response = await fetch(`${this.baseUrl}/action/deleteOne`, {
          method: 'POST',
          headers: this.headers,
          body: JSON.stringify({
            collection,
            database: this.database,
            dataSource: this.dataSource,
            filter
          })
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`MongoDB API error: ${response.status} ${response.statusText} - ${errorText}`);
        }
        
        return await response.json();
      } catch (error) {
        console.error('MongoDB deleteOne error:', error);
        throw error;
      }
    },
    
    async aggregate(collection, pipeline) {
      try {
        const response = await fetch(`${this.baseUrl}/action/aggregate`, {
          method: 'POST',
          headers: this.headers,
          body: JSON.stringify({
            collection,
            database: this.database,
            dataSource: this.dataSource,
            pipeline
          })
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`MongoDB API error: ${response.status} ${response.statusText} - ${errorText}`);
        }
        
        const result = await response.json();
        return result.documents || [];
      } catch (error) {
        console.error('MongoDB aggregate error:', error);
        throw error;
      }
    },
    
    // Test connection method
    async testConnection() {
      try {
        // Try to list collections to test connection
        const response = await fetch(`${this.baseUrl}/action/find`, {
          method: 'POST',
          headers: this.headers,
          body: JSON.stringify({
            collection: 'movies',
            database: this.database,
            dataSource: this.dataSource,
            filter: {},
            limit: 1
          })
        });
        
        return response.ok;
      } catch (error) {
        console.error('MongoDB connection test failed:', error);
        return false;
      }
    },
    
    // Wrapper to match MongoDB driver API
    collection(name) {
      const self = this;
      return {
        find: (filter = {}, options = {}) => ({
          toArray: async () => self.find(name, filter, options),
          limit: (count) => ({
            toArray: async () => self.find(name, filter, { ...options, limit: count })
          }),
          sort: (sortSpec) => ({
            toArray: async () => self.find(name, filter, { ...options, sort: sortSpec }),
            limit: (count) => ({
              toArray: async () => self.find(name, filter, { ...options, sort: sortSpec, limit: count })
            })
          })
        }),
        findOne: async (filter) => self.findOne(name, filter),
        insertOne: async (doc) => self.insertOne(name, doc),
        updateOne: async (filter, update, options) => self.updateOne(name, filter, update, options),
        deleteOne: async (filter) => self.deleteOne(name, filter),
        aggregate: (pipeline) => ({
          toArray: async () => self.aggregate(name, pipeline)
        }),
        findOneAndUpdate: async (filter, update, options = {}) => {
          const result = await self.updateOne(name, filter, update, options);
          if (options.returnDocument === 'after' || options.returnNewDocument) {
            const document = await self.findOne(name, filter);
            return { value: document };
          }
          return result;
        },
        // Text search support
        createIndex: async () => Promise.resolve(), // No-op for Atlas Data API
        // For search functionality
        textSearch: async (query) => {
          // Use aggregation for text search
          return self.aggregate(name, [
            {
              $match: {
                $or: [
                  { title: { $regex: query, $options: 'i' } },
                  { 'details.overview': { $regex: query, $options: 'i' } },
                  { original_title: { $regex: query, $options: 'i' } }
                ]
              }
            }
          ]);
        }
      };
    }
  };
  
  // Test the connection before returning
  const isConnected = await mongoAPI.testConnection();
  if (!isConnected) {
    throw new Error('Failed to connect to MongoDB Atlas Data API');
  }
  
  return mongoAPI;
}