import os
import csv

CSV_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "안전운임 프로젝트 데이터", "DB_파싱데이터")

# 파일명 → (port, trip_type) 매핑
FILE_MAP = {
    "왕복_인천신항.csv": ("인천신항", "왕복"),
    "왕복_인천항.csv":   ("인천항",   "왕복"),
    "왕복_의왕ICD.csv":  ("의왕ICD",  "왕복"),
    "편도_부산신항.csv": ("부산신항", "편도"),
    "편도_부산북항.csv": ("부산북항", "편도"),
    "편도_광양항.csv":   ("광양항",   "편도"),
}

def load_csv_records():
    all_records = []
    for filename, (port, trip_type) in FILE_MAP.items():
        filepath = os.path.join(CSV_DIR, filename)
        if not os.path.exists(filepath):
            print(f"⚠️  파일 없음: {filename} — 건너뜀")
            continue
        with open(filepath, encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            count = 0
            for row in reader:
                all_records.append({
                    "port":         port,
                    "trip_type":    trip_type,
                    "sido":         row["sido"].strip(),
                    "sigungu":      row["sigungu"].strip(),
                    "eupmyeondong": row["eupmyeondong"].strip(),
                    "distance_km":  row["distance_km"].strip(),
                    "ft40_round":   row["ft40_round"].strip(),
                    "ft20_round":   row["ft20_round"].strip(),
                })
                count += 1
        print(f"✅ {filename:<22} {count}건 로드")
    return all_records

def val(v):
    if v is None or str(v).strip() in ("nan", "None", ""):
        return "NULL"
    try:
        return str(int(float(v)))
    except Exception:
        return f"'{str(v)}'"

def save_split_sql(records, chunk_size=500):
    with open("data_init.sql", "w", encoding="utf-8") as f:
        f.write("DROP TABLE IF EXISTS freight_rates;\n")
        f.write("DROP TABLE IF EXISTS companies;\n")

    total = len(records)
    file_num = 1
    for i in range(0, total, chunk_size):
        chunk = records[i:i + chunk_size]
        filename = f"data_{file_num:03d}.sql"
        with open(filename, "w", encoding="utf-8") as f:
            for r in chunk:
                f.write(
                    f"INSERT INTO freight_rates "
                    f"(port, trip_type, sido, sigungu, eupmyeondong, distance_km, ft40_round, ft20_round) VALUES ("
                    f"'{r['port']}', '{r['trip_type']}', '{r['sido']}', '{r['sigungu']}', '{r['eupmyeondong']}', "
                    f"{val(r['distance_km'])}, {val(r['ft40_round'])}, {val(r['ft20_round'])}"
                    f");\n"
                )
        print(f"✅ {filename} 생성 ({len(chunk)}건)")
        file_num += 1

    print(f"\n총 {file_num - 1}개 파일 생성 완료 ({total}건)")
    print("\n아래 명령어를 순서대로 실행하세요:")
    print("npx wrangler d1 execute freight-rate-db --local --file=./data_init.sql")
    for n in range(1, file_num):
        print(f"npx wrangler d1 execute freight-rate-db --local --file=./data_{n:03d}.sql")

if __name__ == "__main__":
    print(f"CSV 폴더: {CSV_DIR}\n")
    records = load_csv_records()
    print(f"\n총 {len(records)}건 파싱 완료\n")
    save_split_sql(records)
