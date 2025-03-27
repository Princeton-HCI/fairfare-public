"""
This script updates the translations in src/lang from an inputted excel file.

Usage:
    Update the NEW_TRANSLATIONS_FILENAME file with the new translations.
    Then run:
    python update_translations_from_excel.py

AS 2023-12-04
"""

import pandas as pd
import json

NEW_TRANSLATIONS_FILENAME = 'System_Translations_20231204.xlsx'

# we want to update the translations in src/lang

# read the excel file as a df

df = pd.read_excel(NEW_TRANSLATIONS_FILENAME)

# get the languages
languages = df.columns[1:]

# get the keys
keys = df['key']

translations = df[languages]

# for each language, write the translations to the appropriate file
for language in languages:
    # get the translations for this language
    translations_for_this_language = translations[language]
    
    # get the filename for this language
    filename = 'src/lang/' + language + '.json'

    # zip the keys and translations together, and save to a dict
    translations_dict = dict(zip(keys, translations_for_this_language))

    # save
    with open(filename, 'w') as f:
        # dump while keeping emoji
        json.dump(translations_dict, f, indent=4, ensure_ascii=False)
