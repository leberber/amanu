
  -- Create promotions table                                                                                                             
  CREATE TABLE IF NOT EXISTS promotions (                                                                                                
      id SERIAL PRIMARY KEY,                                                                                                             
      name VARCHAR(100) NOT NULL,                                                                                                        
      description TEXT,                                                                                                                  
      code VARCHAR(50) UNIQUE,                                                                                                           
      name_translations JSONB DEFAULT '{}',                                                                                              
      description_translations JSONB DEFAULT '{}',                                                                                       
      discount_type VARCHAR(20) NOT NULL DEFAULT 'percentage',                                                                           
      discount_value DECIMAL(10, 2) NOT NULL,                                                                                            
      scope VARCHAR(20) NOT NULL DEFAULT 'global',                                                                                       
      category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,                                                                  
      brand_id INTEGER REFERENCES brands(id) ON DELETE SET NULL,                                                                         
      product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,                                                                     
      min_order_amount DECIMAL(10, 2) DEFAULT 0,                                                                                         
      max_discount DECIMAL(10, 2),                                                                                                       
      usage_limit INTEGER,                                                                                                               
      usage_count INTEGER DEFAULT 0,                                                                                                     
      start_date TIMESTAMP NOT NULL,                                                                                                     
      end_date TIMESTAMP NOT NULL,                                                                                                       
      is_active BOOLEAN DEFAULT TRUE,                                                                                                    
      created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,                                                                        
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,                                                                                    
      updated_at TIMESTAMP                                                                                                               
  );                                                                                                                                     
                                                                                                                                         
  -- Create promotion_usages table                                                                                                       
  CREATE TABLE IF NOT EXISTS promotion_usages (                                                                                          
      id SERIAL PRIMARY KEY,                                                                                                             
      promotion_id INTEGER NOT NULL REFERENCES promotions(id) ON DELETE CASCADE,                                                         
      order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,                                                                 
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,                                                                   
      discount_applied DECIMAL(10, 2) NOT NULL,                                                                                          
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,                                                                                    
      UNIQUE(promotion_id, order_id)                                                                                                     
  );                                                                                                                                     
                                                                                                                                         
  -- Add columns to orders table                                                                                                         
  ALTER TABLE orders ADD COLUMN IF NOT EXISTS promotion_id INTEGER REFERENCES promotions(id) ON DELETE SET NULL;                         
  ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(10, 2) DEFAULT 0;                                                  
  ALTER TABLE orders ADD COLUMN IF NOT EXISTS subtotal DECIMAL(10, 2);                                                                   
                                                                                                                                         
  -- Update existing orders                                                                                                              
  UPDATE orders SET subtotal = total_amount WHERE subtotal IS NULL; 





    ALTER TABLE products ADD COLUMN IF NOT EXISTS pieces_per_box INTEGER;                                                                                                           
                                                                                                                                                                                  
  -- 2. Remove pieces_per_box from order_items table (was added by mistake earlier)                                                                                               
  ALTER TABLE order_items DROP COLUMN IF EXISTS pieces_per_box;                                                                                                                   
                                                                                                                                                                                  
  -- 3. Remove quantity_config from products table (no longer needed)                                                                                                             
  ALTER TABLE products DROP COLUMN IF EXISTS quantity_config; 

    -- Add packaging_type column to products table                                                                                                                                                              
  ALTER TABLE products ADD COLUMN packaging_type VARCHAR(20) DEFAULT 'carton';                                                                                                                                
                                                                                                                                                                                                              
  -- Update existing products to have 'carton' as default (optional, since DEFAULT handles this)                                                                                                              
  UPDATE products SET packaging_type = 'carton' WHERE packaging_type IS NULL;    