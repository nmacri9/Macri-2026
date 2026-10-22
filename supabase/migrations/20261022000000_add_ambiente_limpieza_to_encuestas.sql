-- Agregar columna ambiente_limpieza a la tabla encuestas
-- Esta columna almacena la valoración del ambiente y limpieza del local (Excelente, Buena, Regular, Mala)

ALTER TABLE encuestas
ADD COLUMN IF NOT EXISTS ambiente_limpieza TEXT CHECK (ambiente_limpieza IN ('Excelente', 'Buena', 'Regular', 'Mala'));

COMMENT ON COLUMN encuestas.ambiente_limpieza IS 'Valoración del ambiente y limpieza del local por el cliente';