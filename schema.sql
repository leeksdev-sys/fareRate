CREATE TABLE IF NOT EXISTS freight_rates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  port TEXT NOT NULL,
  sido TEXT NOT NULL,
  sigungu TEXT,
  eupmyeondong TEXT,
  distance_km INTEGER,
  ft40_round INTEGER,
  ft20_round INTEGER,
  trip_type TEXT NOT NULL DEFAULT '왕복',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_port ON freight_rates(port);
CREATE INDEX IF NOT EXISTS idx_sido ON freight_rates(sido);
CREATE INDEX IF NOT EXISTS idx_sigungu ON freight_rates(sigungu);
CREATE INDEX IF NOT EXISTS idx_eupmyeondong ON freight_rates(eupmyeondong);
CREATE INDEX IF NOT EXISTS idx_port_sido ON freight_rates(port, sido);
CREATE INDEX IF NOT EXISTS idx_trip_type ON freight_rates(trip_type);

CREATE TABLE IF NOT EXISTS companies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,  
  sido TEXT NOT NULL,
  sigungu TEXT,
  eupmyeondong TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_company_name ON companies(name);