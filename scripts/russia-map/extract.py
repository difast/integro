import json, sys
src, out = sys.argv[1], sys.argv[2]
names = {
"Adygey":("RU-AD","Республика Адыгея"),"Gorno-Altay":("RU-AL","Республика Алтай"),"Altay":("RU-ALT","Алтайский край"),
"Amur":("RU-AMU","Амурская область"),"Arkhangel'sk":("RU-ARK","Архангельская область"),"Astrakhan'":("RU-AST","Астраханская область"),
"Bashkortostan":("RU-BA","Республика Башкортостан"),"Belgorod":("RU-BEL","Белгородская область"),"Bryansk":("RU-BRY","Брянская область"),
"Buryat":("RU-BU","Республика Бурятия"),"Chechnya":("RU-CE","Чеченская Республика"),"Chelyabinsk":("RU-CHE","Челябинская область"),
"Chukchi Autonomous Okrug":("RU-CHU","Чукотский автономный округ"),"Chuvash":("RU-CU","Чувашская Республика"),"Dagestan":("RU-DA","Республика Дагестан"),
"Ingush":("RU-IN","Республика Ингушетия"),"Irkutsk":("RU-IRK","Иркутская область"),"Ivanovo":("RU-IVA","Ивановская область"),
"Kamchatka":("RU-KAM","Камчатский край"),"Kabardin-Balkar":("RU-KB","Кабардино-Балкарская Республика"),"Karachay-Cherkess":("RU-KC","Карачаево-Черкесская Республика"),
"Krasnodar":("RU-KDA","Краснодарский край"),"Kemerovo":("RU-KEM","Кемеровская область — Кузбасс"),"Kaliningrad":("RU-KGD","Калининградская область"),
"Kurgan":("RU-KGN","Курганская область"),"Khabarovsk":("RU-KHA","Хабаровский край"),"Khanty-Mansiy":("RU-KHM","Ханты-Мансийский автономный округ — Югра"),
"Kirov":("RU-KIR","Кировская область"),"Khakass":("RU-KK","Республика Хакасия"),"Kalmyk":("RU-KL","Республика Калмыкия"),
"Kaluga":("RU-KLU","Калужская область"),"Komi":("RU-KO","Республика Коми"),"Kostroma":("RU-KOS","Костромская область"),
"Karelia":("RU-KR","Республика Карелия"),"Kursk":("RU-KRS","Курская область"),"Krasnoyarsk":("RU-KYA","Красноярский край"),
"Leningrad":("RU-LEN","Ленинградская область"),"Lipetsk":("RU-LIP","Липецкая область"),"Maga Buryatdan":("RU-MAG","Магаданская область"),
"Mariy-El":("RU-ME","Республика Марий Эл"),"Mordovia":("RU-MO","Республика Мордовия"),"Moskva":("RU-MOW","Москва"),
"Moskovskaya":("RU-MOS","Московская область"),"Murmansk":("RU-MUR","Мурманская область"),"Nenets":("RU-NEN","Ненецкий автономный округ"),
"Novgorod":("RU-NGR","Новгородская область"),"Nizhegorod":("RU-NIZ","Нижегородская область"),"Novosibirsk":("RU-NVS","Новосибирская область"),
"Omsk":("RU-OMS","Омская область"),"Orenburg":("RU-ORE","Оренбургская область"),"Orel":("RU-ORL","Орловская область"),
"Perm'":("RU-PER","Пермский край"),"Penza":("RU-PNZ","Пензенская область"),"Primor'ye":("RU-PRI","Приморский край"),
"Pskov":("RU-PSK","Псковская область"),"Rostov":("RU-ROS","Ростовская область"),"Ryazan'":("RU-RYA","Рязанская область"),
"Sakha (Yakutia)":("RU-SA","Республика Саха (Якутия)"),"Sakhalin":("RU-SAK","Сахалинская область"),"Samara":("RU-SAM","Самарская область"),
"Saratov":("RU-SAR","Саратовская область"),"North Ossetia":("RU-SE","Республика Северная Осетия — Алания"),"Smolensk":("RU-SMO","Смоленская область"),
"City of St. Petersburg":("RU-SPE","Санкт-Петербург"),"Stavropol'":("RU-STA","Ставропольский край"),"Sverdlovsk":("RU-SVE","Свердловская область"),
"Tatarstan":("RU-TA","Республика Татарстан"),"Tambov":("RU-TAM","Тамбовская область"),"Tomsk":("RU-TOM","Томская область"),
"Tula":("RU-TUL","Тульская область"),"Tver'":("RU-TVE","Тверская область"),"Tuva":("RU-TY","Республика Тыва"),
"Tyumen'":("RU-TYU","Тюменская область"),"Udmurt":("RU-UD","Удмуртская Республика"),"Ul'yanovsk":("RU-ULY","Ульяновская область"),
"Volgograd":("RU-VGG","Волгоградская область"),"Vladimir":("RU-VLA","Владимирская область"),"Vologda":("RU-VLG","Вологодская область"),
"Voronezh":("RU-VOR","Воронежская область"),"Yamal-Nenets":("RU-YAN","Ямало-Ненецкий автономный округ"),"Yaroslavl'":("RU-YAR","Ярославская область"),
"Yevrey":("RU-YEV","Еврейская автономная область"),"Chita":("RU-ZAB","Забайкальский край"),
"Sevastopol":("RU-SEV","Севастополь"),"Crimea":("RU-CR","Республика Крым"),
}
ukr = {"UA-14":("RU-DON","Донецкая Народная Республика"),"UA-09":("RU-LUG","Луганская Народная Республика"),
       "UA-23":("RU-ZAP","Запорожская область"),"UA-65":("RU-KHE","Херсонская область")}
d = json.load(open(src))
feats = []
for f in d["features"]:
    p = f["properties"]
    if p.get("adm0_a3") == "RUS" and p.get("name") in names:
        code, name = names[p["name"]]
    elif p.get("adm0_a3") == "UKR" and p.get("iso_3166_2") in ukr:
        code, name = ukr[p["iso_3166_2"]]
    else:
        continue
    feats.append({"type": "Feature", "properties": {"id": code, "name": name}, "geometry": f["geometry"]})
ids = [f["properties"]["id"] for f in feats]
assert len(ids) == 89 and len(set(ids)) == 89, (len(ids), len(set(ids)))
json.dump({"type": "FeatureCollection", "features": feats}, open(out, "w"), ensure_ascii=False)
print("ok", len(feats))
