import os
__location__ = os.path.realpath(
    os.path.join(os.getcwd(), os.path.dirname(__file__)))
path = 'city_temperature.csv'
f = open(os.path.join(__location__, path))

import pandas as pd


df = pd.read_csv(os.path.join(__location__, path))

df_new = df[df.Year > 2013]
df_new.to_csv(os.path.join(__location__,path), index=False)