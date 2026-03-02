import pandas as pd

EXCEL_FILE = "SafeFreightRate_20260130.xlsx"

def parse_excel(file_path):
    xl = pd.ExcelFile(file_path)
    all_records = []
    for sheet_name in xl.sheet_names:
        print(f"처리 중: {sheet_name}")
        df = pd.read_excel(file_path, sheet_name=sheet_name, header=0)
        df = df.dropna(how='all')
        for _, row in df.iterrows():
            sido = str(row.get('sido', '')).strip()
            if sido in ('nan', ''):
                continue
            all_records.append({
                "port": sheet_name,
                "sido": sido,
                "sigungu": str(row.get('sigungu', '')).strip(),
                "eupmyeondong": str(row.get('eupmyeondong', '')).strip(),
                "distance_km": row.get('distance', None),
                "ft40_round": row.get('40ft_round', None),
                "ft20_round": row.get('20ft_round', None),
            })
    return all_records

def val(v):
    if v is None or str(v) in ('nan', 'None', ''):
        return 'NULL'
    try:
        return str(int(float(v)))
    except:
        return f"'{str(v)}'"

def save_split_sql(records, chunk_size=500):
    # 초기화 파일
    with open("data_init.sql", "w", encoding="utf-8") as f:
        f.write("DELETE FROM freight_rates;\n")
    
    # 분할 파일 생성
    total = len(records)
    file_num = 1
    for i in range(0, total, chunk_size):
        chunk = records[i:i+chunk_size]
        filename = f"data_{file_num:03d}.sql"
        with open(filename, "w", encoding="utf-8") as f:
            for r in chunk:
                f.write(
                    f"INSERT INTO freight_rates "
                    f"(port, sido, sigungu, eupmyeondong, distance_km, ft40_round, ft20_round) VALUES ("
                    f"'{r['port']}', '{r['sido']}', '{r['sigungu']}', '{r['eupmyeondong']}', "
                    f"{val(r['distance_km'])}, {val(r['ft40_round'])}, {val(r['ft20_round'])}"
                    f");\n"
                )
        print(f"✅ {filename} 생성 ({len(chunk)}건)")
        file_num += 1
    
    print(f"\n총 {file_num-1}개 파일 생성 완료 ({total}건)")
    print("\n아래 명령어를 순서대로 실행하세요:")
    print("npx wrangler d1 execute freight-rate-db --local --file=./data_init.sql")
    for n in range(1, file_num):
        print(f"npx wrangler d1 execute freight-rate-db --local --file=./data_{n:03d}.sql")

if __name__ == "__main__":
    records = parse_excel(EXCEL_FILE)
    print(f"총 {len(records)}건 파싱 완료\n")
    save_split_sql(records)