import os
import psycopg
import json
from psycopg.sql import SQL, Identifier, Literal
from contextlib import contextmanager

class PostgesAPI:
    def __init__(self, con_string) -> None:
        self.con_string = con_string

    
    def print_msg(self, msg):
        _mes_len = 50
        _char = "-"
        _half = ((_mes_len - len(msg) -2 ) // 2) * _char
        print(_mes_len * _char)
        print(f"{_half} {msg} {_half}")
        print("")

    
    @contextmanager
    def transaction(self):
        conn = psycopg.connect(self.con_string)
        try:
            with conn.cursor() as cur:
                yield cur
            conn.commit()
        except Exception as e:
            conn.rollback()
            print("Transaction error:", e)
            raise
        finally:
            conn.close()

    def safe_insert(self, table_name, records):

        with psycopg.connect(self.con_string) as conn:
            with conn.cursor() as cur:
                # Convert a single dictionary into a list for consistency
                if isinstance(records, dict):
                    records = [records]
                
                # Make a copy of records to avoid modifying the original
                processed_records = []
                
                for record in records:
                    # Create a copy of the record
                    processed_record = dict(record)
                    
                    # Convert any dictionary values to JSON strings
                    for key, value in processed_record.items():
                        if isinstance(value, dict) or isinstance(value, list):
                            processed_record[key] = json.dumps(value)
                    
                    processed_records.append(processed_record)
                
                # Extract column names
                cols = ', '.join(processed_records[0].keys())
                
                # Create placeholders for parameterized query
                placeholders = ', '.join(['%s'] * len(processed_records[0]))
                
                # Construct SQL statement
                insert_query = f"""INSERT INTO {table_name} ({cols}) VALUES ({placeholders})"""
                
                # Convert records into a list of tuples (for parameter substitution)
                values = [tuple(record.values()) for record in processed_records]
                
                # Execute the query safely
                cur.executemany(insert_query, values)
                conn.commit()
        
        return f'{len(records)} records were inserted'
        


    def safe_update(self, table_name, params):
        """
        Update user information in the specified table.

        Parameters:
        - table_name (str): The name of the table to update.
        - params (dict): Dictionary with:
            - 'SET' (dict): Column-value pairs to update.
            - 'WHERE' (str): Column used in the WHERE condition.
            - 'CONDITION': Value to match in the WHERE condition.

        Example:
            params = {
                'SET': {'name': 'John Doe', 'email': 'john@example.com'},
                'WHERE': 'id',
                'CONDITION': 123
            }

        Returns:
        - str: Success message or error message.
        """
    
        with psycopg.connect(self.con_string) as conn:
            with conn.cursor() as cur:
                # Generate SET clause dynamically for multiple fields
                set_clause = SQL(", ").join(
                    SQL("{} = {}").format(Identifier(k), Literal(v)) for k, v in params['SET'].items()
                )

                update_query = SQL("UPDATE {} SET {} WHERE {} = {}").format(
                    Identifier(table_name),
                    set_clause,
                    Identifier(params['WHERE']),
                    Literal(params['CONDITION'])
                )

            
                cur.execute(update_query)
                conn.commit()
        
        return 'Update executed successfully'

        
    def insert(self, table_name, records):
        # self.print_msg('insert')
        try:
            with psycopg.connect(self.con_string) as conn:
                with conn.cursor() as cur:
                    if isinstance(records, dict): records = [records] 
                    cols = ', '.join(list(records[0].keys()))
                    vals = ', '.join([f"{tuple(record.values())}" for record in records])
                    insert_statements = f"""INSERT INTO {table_name} ({cols}) VALUES {vals}"""
         
                    cur.execute(insert_statements)
                    conn.commit()
            return f'{len(records)} records were inserted'
        except Exception as e:
            print(e)
        

    def update(self, sql_statements):
        # self.print_msg('update')
        try:
            with psycopg.connect(self.con_string) as conn:
                with conn.cursor() as cur:
                    cur.execute(sql_statements)
                    conn.commit()
            return 'SQL Executed successfully'
        except Exception as e:
            print(e)
        


    def select(self, sql_statements):
        # self.print_msg('select')
        try:
            with psycopg.connect(self.con_string, row_factory = psycopg.rows.dict_row) as conn:
                with conn.cursor() as cur:
                    cur.execute(sql_statements)
                    # columns = tuple([desc[0] for desc in cur.description])
                    data = cur.fetchall()
            return  data
        except Exception as e:
            print(e)

    def safe_select(self, table_name, conditions=None):
        """
        Executes a SELECT query on the specified table with optional conditions.
    
        Parameters:
        - table_name (str): The name of the table to select data from.
        - conditions (dict, optional): A dictionary specifying the WHERE clause conditions.
          Each key is a column name, and the corresponding value is the condition value.
          Example: {'id': 123, 'name': 'John Doe'}
    
        Returns:
        - list: A list of dictionaries containing the query results.
    
        Raises:
        - Exception: If the SELECT operation fails.
        """
        # self.print_msg('select')
        try:
            with psycopg.connect(self.con_string, row_factory=psycopg.rows.dict_row) as conn:
                with conn.cursor() as cur:
                    # Base SELECT statement
                    query = SQL("SELECT * FROM {}").format(Identifier(table_name))
    
                    # Add conditions if provided
                    if conditions:
                        where_clause = SQL(" WHERE ") + SQL(" AND ").join(
                            SQL("{} = {}").format(Identifier(col), Literal(val))
                            for col, val in conditions.items()
                        )
                        query = query + where_clause
    
                    # Execute the query
                    cur.execute(query)
                    data = cur.fetchall()
    
            return data
        except Exception as e:
            print(e)




    def create(self, sql_file):
        # self.print_msg('create')
        try:
            with psycopg.connect(self.con_string) as conn:
                with conn.cursor() as cur:
                    with open(sql_file, 'r') as sql_file:
                        sql_stms = sql_file.read().split(';')
                        for stm in sql_stms:
                            print(stm)
                            cur.execute(stm)
                            conn.commit()
            return 'SQL Executed successfully'
        except Exception as e:
            print(e)

    def safe_delete(self, table_name, conditions):
        """
        Deletes records from the specified table based on given conditions.
    
        Parameters:
        - table_name (str): The name of the table from which to delete records.
        - conditions (dict): A dictionary specifying the WHERE clause conditions.
          Each key is a column name, and the corresponding value is the condition value.
          Example: {'id': 123, 'status': 'inactive'}
    
        Returns:
        - str: A message indicating the result of the delete operation.
    
        Raises:
        - Exception: If the delete operation fails.
        """
        self.print_msg('delete')
        try:
            with psycopg.connect(self.con_string) as conn:
                with conn.cursor() as cur:
                    # Construct the DELETE query
                    query = SQL("DELETE FROM {}").format(Identifier(table_name))
    
                    # Add conditions for the WHERE clause
                    if conditions:
                        where_clause = SQL(" WHERE ") + SQL(" AND ").join(
                            SQL("{} = {}").format(Identifier(col), Literal(val))
                            for col, val in conditions.items()
                        )
                        query = query + where_clause
    
                    # Execute the query
                    cur.execute(query)
                    conn.commit()
    
            return 'Records deleted successfully'
        except Exception as e:
            print(e)

    def safe_insert_tx(self, cur, table_name, records):
        if isinstance(records, dict):
            records = [records]

        processed_records = []
        for record in records:
            processed_record = dict(record)
            for key, value in processed_record.items():
                if isinstance(value, (dict, list)):
                    processed_record[key] = json.dumps(value)
            processed_records.append(processed_record)

        cols = ', '.join(processed_records[0].keys())
        placeholders = ', '.join(['%s'] * len(processed_records[0]))
        insert_query = f"""INSERT INTO {table_name} ({cols}) VALUES ({placeholders})"""
        values = [tuple(record.values()) for record in processed_records]
        cur.executemany(insert_query, values)

    def safe_update_tx(self, cur, table_name, params):
        set_clause = SQL(", ").join(
            SQL("{} = {}").format(Identifier(k), Literal(v)) for k, v in params['SET'].items()
        )

        update_query = SQL("UPDATE {} SET {} WHERE {} = {}").format(
            Identifier(table_name),
            set_clause,
            Identifier(params['WHERE']),
            Literal(params['CONDITION'])
        )

        cur.execute(update_query)

    def get_next_sequence_value(self, sequence_name):
        """
        Retrieves the next value from the specified sequence.
        
        Parameters:
        - sequence_name (str): The name of the sequence.
        
        Returns:
        - int: The next value in the sequence.
        """
        try:
            with psycopg.connect(self.con_string) as conn:
                with conn.cursor() as cur:
           
                    cur.execute(f"SELECT nextval('{sequence_name}');")
                    # Fetch the next value
                    result = cur.fetchone()
                    return result[0]  # Assuming the next value is in the first column
        except Exception as e:
            print(f"Error retrieving next sequence value: {e}")
            return None