-- Vehicle Pricing Database Schema
-- Based on Excel columns: A=yearRange, B=make, C=model, F=key, H=keyMinPrice, J=remoteMinPrice, L=p2sMinPrice, N=ignitionMinPrice

-- Create vehicles table
CREATE TABLE IF NOT EXISTS vehicles (
    id SERIAL PRIMARY KEY,
    year_range VARCHAR(50) NOT NULL,
    make VARCHAR(100) NOT NULL,
    model VARCHAR(100) NOT NULL,
    key_type VARCHAR(200),
    key_min_price VARCHAR(20),
    remote_min_price VARCHAR(20), 
    p2s_min_price VARCHAR(20),
    ignition_min_price VARCHAR(20),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for faster searches
CREATE INDEX IF NOT EXISTS idx_vehicles_make_model ON vehicles (LOWER(make), LOWER(model));
CREATE INDEX IF NOT EXISTS idx_vehicles_make ON vehicles (LOWER(make));
CREATE INDEX IF NOT EXISTS idx_vehicles_year_range ON vehicles (year_range);

-- Create audit table for tracking price changes
CREATE TABLE IF NOT EXISTS price_updates (
    id SERIAL PRIMARY KEY,
    vehicle_id INTEGER REFERENCES vehicles(id),
    user_id VARCHAR(100) NOT NULL, -- WhatsApp user ID
    field_changed VARCHAR(50) NOT NULL, -- 'key_min_price', 'remote_min_price', etc.
    old_value VARCHAR(20),
    new_value VARCHAR(20),
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create index for audit queries
CREATE INDEX IF NOT EXISTS idx_price_updates_vehicle_id ON price_updates (vehicle_id);
CREATE INDEX IF NOT EXISTS idx_price_updates_changed_at ON price_updates (changed_at);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for updated_at
CREATE TRIGGER update_vehicles_updated_at 
    BEFORE UPDATE ON vehicles 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();