"""
This script creates an excel file with the translations from src/lang.
This can be used for translators to update the translations, i.e., in
a shared Google Sheet.

AS 2023-12-04
"""

import pandas as pd
import os

directory = 'src/lang'

files = os.listdir(directory)

dfs = []

# for each file in directory, load as dataframe from json
for file in files:
    # flatten nested dictionary into columns then load into df
    df = pd.json_normalize(pd.read_json(os.path.join(directory, file)).to_dict())
    dfs.append(df)

# concat all dfs into one, joining on the columns
df = pd.concat(dfs, axis=0)
# transpose df so that each row is a language
df = df.transpose()
# reset index so that language is a column
df = df.reset_index()
# rename columns
languages = [file.split('.')[0] for file in files]
df.columns = ['key'] + languages
# drop rows with more than 2 null values
df = df.dropna(thresh=2)
# save as excel without index
df.to_excel('translations.xlsx', index=False)
