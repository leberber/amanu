import os
import psycopg
from psycopg.sql import SQL, Identifier, Literal

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

    def safe_insert(self, table_name, records):
        try:
            with psycopg.connect(self.con_string) as conn:
                with conn.cursor() as cur:
                    # Convert a single dictionary into a list for consistency
                    if isinstance(records, dict): 
                        records = [records] 
    
                    # Extract column names
                    cols = ', '.join(records[0].keys())
    
                    # Create placeholders for parameterized query
                    placeholders = ', '.join(['%s'] * len(records[0]))
    
                    # Construct SQL statement
                    insert_query = f"""INSERT INTO {table_name} ({cols}) VALUES ({placeholders})"""
    
                    # Convert records into a list of tuples (for parameter substitution)
                    values = [tuple(record.values()) for record in records]
    
                    # Execute the query safely
                    cur.executemany(insert_query, values)
                    conn.commit()
    
            return f'{len(records)} records were inserted'
    
        except Exception as e:
            print("Error:", e)
        
    def insert(self, table_name, records):
        # self.print_msg('insert')
        try:
            with psycopg.connect(self.con_string) as conn:
                with conn.cursor() as cur:
                    if isinstance(records, dict): records = [records] 
                    cols = ', '.join(list(records[0].keys()))
                    vals = ', '.join([f"{tuple(record.values())}" for record in records])
                    insert_statements = f"""INSERT INTO {table_name} ({cols}) VALUES {vals}"""
                    print(insert_statements)
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
        try:
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

                    print(update_query.as_string(conn))  # Debugging: Print the final SQL query
                    cur.execute(update_query)
                    conn.commit()
            
            return 'Update executed successfully'
        except Exception as e:
            print(e)
            return 'Update failed'


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


