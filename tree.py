from directory_tree import DisplayTree
import os

if __name__ == '__main__':
    DisplayTree(
        os.path.abspath('ec2'), 
        ignoreList=['.git', 'node_modules', '__pycache__', '.pytest_cache'],
         showHidden=True
        
    )