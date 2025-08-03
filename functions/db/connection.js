// functions/db/connection.js - D1 Database wrapper
export async function connectDB(env) {
  // D1 database wrapper to match MongoDB-like API
  const d1Wrapper = {
    db: env.DB, // D1 database binding
    
    collection(name) {
      const self = this;
      
      return {
        async find(filter = {}, options = {}) {
          try {
            let query = `SELECT * FROM ${name}`;
            const params = [];
            
            // Build WHERE clause from filter
            if (Object.keys(filter).length > 0) {
              const conditions = [];
              for (const [key, value] of Object.entries(filter)) {
                if (typeof value === 'object' && value.$exists !== undefined) {
                  // Handle $exists operator
                  if (value.$exists) {
                    conditions.push(`${key} IS NOT NULL AND ${key} != ''`);
                  } else {
                    conditions.push(`(${key} IS NULL OR ${key} = '')`);
                  }
                } else if (typeof value === 'object' && value.$regex) {
                  // Handle regex search (case insensitive)
                  conditions.push(`${key} LIKE ?`);
                  params.push(`%${value.$regex}%`);
                } else {
                  // Regular equality
                  conditions.push(`${key} = ?`);
                  params.push(value);
                }
              }
              if (conditions.length > 0) {
                query += ` WHERE ${conditions.join(' AND ')}`;
              }
            }
            
            // Add sorting
            if (options.sort) {
              const sortClauses = [];
              for (const [field, direction] of Object.entries(options.sort)) {
                sortClauses.push(`${field} ${direction === -1 ? 'DESC' : 'ASC'}`);
              }
              if (sortClauses.length > 0) {
                query += ` ORDER BY ${sortClauses.join(', ')}`;
              }
            }
            
            // Add limit
            if (options.limit) {
              query += ` LIMIT ${options.limit}`;
            }
            
            console.log('D1 Query:', query, 'Params:', params);
            
            const stmt = self.db.prepare(query);
            const result = await (params.length > 0 ? stmt.bind(...params).all() : stmt.all());
            
            return {
              toArray: async () => result.results.map(row => {
                // Parse JSON fields
                const parsed = { ...row, _id: row.id };
                if (row.details) {
                  try {
                    parsed.details = JSON.parse(row.details);
                  } catch (e) {
                    console.warn('Failed to parse details JSON:', e);
                  }
                }
                if (row.file_info) {
                  try {
                    parsed.file_info = JSON.parse(row.file_info);
                  } catch (e) {
                    console.warn('Failed to parse file_info JSON:', e);
                  }
                }
                return parsed;
              })
            };
          } catch (error) {
            console.error('D1 find error:', error);
            throw error;
          }
        },
        
        async findOne(filter) {
          try {
            const result = await this.find(filter, { limit: 1 });
            const results = await result.toArray();
            return results.length > 0 ? results[0] : null;
          } catch (error) {
            console.error('D1 findOne error:', error);
            throw error;
          }
        },
        
        async insertOne(document) {
          try {
            const { _id, id, ...data } = document;
            
            // Generate ID if not provided
            const insertId = id || _id || `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            
            // Stringify JSON fields
            if (data.details && typeof data.details === 'object') {
              data.details = JSON.stringify(data.details);
            }
            if (data.file_info && typeof data.file_info === 'object') {
              data.file_info = JSON.stringify(data.file_info);
            }
            
            const fields = ['id', ...Object.keys(data)];
            const values = [insertId, ...Object.values(data)];
            const placeholders = fields.map(() => '?').join(', ');
            
            const query = `INSERT INTO ${name} (${fields.join(', ')}) VALUES (${placeholders})`;
            console.log('D1 Insert:', query, values);
            
            const stmt = self.db.prepare(query);
            const result = await stmt.bind(...values).run();
            
            return { 
              insertedId: insertId,
              success: result.success
            };
          } catch (error) {
            console.error('D1 insertOne error:', error);
            throw error;
          }
        },
        
        async updateOne(filter, update, options = {}) {
          try {
            const updateData = update.$set || update;
            
            // Stringify JSON fields
            if (updateData.details && typeof updateData.details === 'object') {
              updateData.details = JSON.stringify(updateData.details);
            }
            if (updateData.file_info && typeof updateData.file_info === 'object') {
              updateData.file_info = JSON.stringify(updateData.file_info);
            }
            
            const setClauses = Object.keys(updateData).map(key => `${key} = ?`);
            const setValues = Object.values(updateData);
            
            // Build WHERE clause
            const whereConditions = [];
            const whereValues = [];
            for (const [key, value] of Object.entries(filter)) {
              whereConditions.push(`${key} = ?`);
              whereValues.push(value);
            }
            
            const query = `UPDATE ${name} SET ${setClauses.join(', ')} WHERE ${whereConditions.join(' AND ')}`;
            const allValues = [...setValues, ...whereValues];
            
            console.log('D1 Update:', query, allValues);
            
            const stmt = self.db.prepare(query);
            const result = await stmt.bind(...allValues).run();
            
            // Handle upsert
            if (options.upsert && result.changes === 0) {
              return await this.insertOne({ ...filter, ...updateData });
            }
            
            return { 
              modifiedCount: result.changes,
              success: result.success
            };
          } catch (error) {
            console.error('D1 updateOne error:', error);
            throw error;
          }
        },
        
        async deleteOne(filter) {
          try {
            const whereConditions = [];
            const whereValues = [];
            for (const [key, value] of Object.entries(filter)) {
              whereConditions.push(`${key} = ?`);
              whereValues.push(value);
            }
            
            const query = `DELETE FROM ${name} WHERE ${whereConditions.join(' AND ')}`;
            console.log('D1 Delete:', query, whereValues);
            
            const stmt = self.db.prepare(query);
            const result = await stmt.bind(...whereValues).run();
            
            return { 
              deletedCount: result.changes,
              success: result.success
            };
          } catch (error) {
            console.error('D1 deleteOne error:', error);
            throw error;
          }
        },
        
        async findOneAndUpdate(filter, update, options = {}) {
          try {
            // First find the document
            const existing = await this.findOne(filter);
            
            // Update it
            const updateResult = await this.updateOne(filter, update, options);
            
            if (options.returnDocument === 'after' || options.returnNewDocument) {
              // Return updated document
              const updated = await this.findOne(filter);
              return { value: updated };
            } else {
              // Return original document
              return { value: existing };
            }
          } catch (error) {
            console.error('D1 findOneAndUpdate error:', error);
            throw error;
          }
        }
      };
    }
  };
  
  return d1Wrapper;
}