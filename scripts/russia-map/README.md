# Карта субъектов РФ для главной страницы

Создаёт `src/data/russia-regions.ts` (контуры 89 субъектов) и `src/data/russia-region-names.ts` (названия).
Запускается вручную, только при обновлении геоданных; на сборку сайта не влияет.

Источник: [Natural Earth](https://www.naturalearthdata.com/), слой *Admin 1 – States, Provinces* 1:10m
(общественное достояние, без ограничений на использование), репозиторий
`nvkelso/natural-earth-vector`, файл `geojson/ne_10m_admin_1_states_provinces.geojson`.

Состав — 89 субъектов по статье 65 Конституции РФ: 83 субъекта с кодом RUS, Республика Крым и Севастополь
(в слое уже с кодом RUS), Донецкая и Луганская Народные Республики, Запорожская и Херсонская области (в слое —
с кодом UKR, границы административных единиц). Названия задаются таблицей в `extract.py` (в исходных данных
есть ошибки: перепутаны ISO-коды Москвы и Московской области, Алтайский край подписан как «Республика Алтай»,
Магаданская область — «Maga Buryatdan»). Безымянный островок `RU-X01~` (около 15 × 7 км) не включается.

```bash
curl -o admin1.geojson https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_1_states_provinces.geojson
python3 scripts/russia-map/extract.py admin1.geojson regions.geojson
npx mapshaper@0.6.102 regions.geojson \
  -proj +proj=aea +lat_1=52 +lat_2=64 +lat_0=56 +lon_0=100 +datum=WGS84 +units=m \
  -clean -dissolve2 id copy-fields=name -filter-islands min-area=60km2 remove-empty \
  -simplify 7% keep-shapes -clean -o format=geojson precision=100 projected.json
python3 scripts/russia-map/topaths.py projected.json src/data/russia-regions.ts src/data/russia-region-names.ts
```

`-dissolve2` склеивает части Чукотского АО, разрезанные по 180-му меридиану, чтобы на карте не было шва.
Острова меньше 60 км² не выводятся (на карте шириной до 1200 px они меньше пикселя).
