import json, sys
src, out_ts, out_names = sys.argv[1], sys.argv[2], sys.argv[3]
d = json.load(open(src))
xs=[];ys=[]
def walk(c):
    if isinstance(c[0],(int,float)): xs.append(c[0]); ys.append(c[1]); return
    for x in c: walk(x)
for f in d["features"]: walk(f["geometry"]["coordinates"])
minx,maxx,miny,maxy=min(xs),max(xs),min(ys),max(ys)
W=1000; pad=4
scale=(W-2*pad)/(maxx-minx); H=round((maxy-miny)*scale+2*pad)
def pt(x,y): return (round((x-minx)*scale+pad,1), round((maxy-y)*scale+pad,1))
def fmt(v): s=f"{v:.1f}"; return s[:-2] if s.endswith(".0") else s
regions=[]
for f in d["features"]:
    g=f["geometry"]; polys=g["coordinates"] if g["type"]=="MultiPolygon" else [g["coordinates"]]
    parts=[]; area_x=0; area=0
    for poly in polys:
        for ring in poly:
            pts=[pt(x,y) for x,y in ring]
            # убираем повторяющиеся точки после округления
            clean=[pts[0]]
            for p in pts[1:]:
                if p!=clean[-1]: clean.append(p)
            if len(clean)<4: continue
            cmd="M"+fmt(clean[0][0])+" "+fmt(clean[0][1])
            prev=clean[0]
            for p in clean[1:-1]:
                cmd+="l"+fmt(p[0]-prev[0])+" "+fmt(p[1]-prev[1]); prev=p
            parts.append(cmd+"z")
            for a,b in zip(clean,clean[1:]):
                cr=a[0]*b[1]-b[0]*a[1]; area+=cr; area_x+=(a[0]+b[0])*cr
    cx = area_x/(3*area) if area else 0
    regions.append({"id":f["properties"]["id"],"name":f["properties"]["name"],"d":"".join(parts),"cx":round(cx,1)})
regions.sort(key=lambda r:r["cx"])
assert len(regions)==89 and all(r["d"] for r in regions)
lines=["/**",
" * Субъекты Российской Федерации (89, по статье 65 Конституции РФ) — контуры для карты на главной.",
" * Источник геометрии: Natural Earth, Admin 1 – States, Provinces, 1:10m (public domain, naturalearthdata.com),",
" * версия 5.2.0-pre. Проекция Альберса (равновеликая коническая, lon_0 = 100°, параллели 52° и 64°), упрощение",
" * mapshaper; названия — официальные. Файл создан скриптами scripts/russia-map/ (см. README там) — вручную не редактировать.",
" * Порядок — с запада на восток (для анимации).",
" */",
f"export const RUSSIA_VIEWBOX = \"0 0 {W} {H}\";",
"",
"export type RussiaRegion = { id: string; name: string; d: string };",
"",
"export const russiaRegions: RussiaRegion[] = ["]
for r in regions:
    lines.append("  "+json.dumps({"id":r["id"],"name":r["name"],"d":r["d"]},ensure_ascii=False)+",")
lines.append("];")
open(out_ts,"w").write("\n".join(lines)+"\n")
nl=["/** Названия субъектов РФ для списка выбора и контекста заявки (создан scripts/russia-map/, вручную не редактировать). */",
"export const russiaRegionNames: Record<string, string> = {"]
for r in sorted(regions,key=lambda r:r["id"]):
    nl.append(f'  "{r["id"]}": {json.dumps(r["name"],ensure_ascii=False)},')
nl.append("};")
open(out_names,"w").write("\n".join(nl)+"\n")
print("H",H,"bytes",sum(len(r["d"]) for r in regions))
