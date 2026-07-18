SET NOCOUNT ON;
SET XACT_ABORT ON;

BEGIN TRY
BEGIN TRANSACTION;

IF NOT EXISTS (SELECT 1 FROM dbo.CatalogoEstadoDiente WHERE Codigo = 'BUENO')
    INSERT INTO dbo.CatalogoEstadoDiente (Codigo, Nombre, Descripcion) VALUES ('BUENO', 'Buen Estado', 'Diente sano o sin alteraciones');
IF NOT EXISTS (SELECT 1 FROM dbo.CatalogoEstadoDiente WHERE Codigo = 'CARIES')
    INSERT INTO dbo.CatalogoEstadoDiente (Codigo, Nombre, Descripcion) VALUES ('CARIES', 'Caries', 'Caries activa o tratada');
IF NOT EXISTS (SELECT 1 FROM dbo.CatalogoEstadoDiente WHERE Codigo = 'ENDODONCIA')
    INSERT INTO dbo.CatalogoEstadoDiente (Codigo, Nombre, Descripcion) VALUES ('ENDODONCIA', 'Endodoncia', 'Tratamiento de conductos');
IF NOT EXISTS (SELECT 1 FROM dbo.CatalogoEstadoDiente WHERE Codigo = 'EXTRACCION')
    INSERT INTO dbo.CatalogoEstadoDiente (Codigo, Nombre, Descripcion) VALUES ('EXTRACCION', 'Extracción', 'Diente extraído o indicado para extracción');

IF NOT EXISTS (SELECT 1 FROM dbo.Odontograma WHERE Nro_Historia = '1001')
BEGIN
    INSERT INTO dbo.Odontograma (Nro_Historia, Version, Fecha_Visita, Tipo_Visita, Observaciones, Metadata, Usuario_Creacion, Activo)
    VALUES ('1001', 1, '2026-07-10', 'Consulta Inicial', 'Paciente piloto para registro de odontograma', '{"origen":"seed"}', 'seed', 1);
END

IF NOT EXISTS (SELECT 1 FROM dbo.Odontograma WHERE Nro_Historia = '1002')
BEGIN
    INSERT INTO dbo.Odontograma (Nro_Historia, Version, Fecha_Visita, Tipo_Visita, Observaciones, Metadata, Usuario_Creacion, Activo)
    VALUES ('1002', 1, '2026-07-12', 'Control', 'Seguimiento post tratamiento', '{"origen":"seed"}', 'seed', 1);
END

DECLARE @odontograma1 INT = (SELECT TOP 1 Id FROM dbo.Odontograma WHERE Nro_Historia = '1001' ORDER BY Id);
DECLARE @odontograma2 INT = (SELECT TOP 1 Id FROM dbo.Odontograma WHERE Nro_Historia = '1002' ORDER BY Id);

IF NOT EXISTS (SELECT 1 FROM dbo.OdontogramaVersion WHERE OdontogramaId = @odontograma1 AND VersionNumber = 1)
BEGIN
    INSERT INTO dbo.OdontogramaVersion (OdontogramaId, VersionNumber, Usuario_Creacion, Locked, Metadata)
    VALUES (@odontograma1, 1, 'seed', 0, '{"fase":"inicial"}');
END

IF NOT EXISTS (SELECT 1 FROM dbo.OdontogramaVersion WHERE OdontogramaId = @odontograma1 AND VersionNumber = 2)
BEGIN
    DECLARE @parentVersion1 INT = (SELECT TOP 1 Id FROM dbo.OdontogramaVersion WHERE OdontogramaId = @odontograma1 AND VersionNumber = 1 ORDER BY Id);
    INSERT INTO dbo.OdontogramaVersion (OdontogramaId, VersionNumber, Usuario_Creacion, ParentVersionId, Locked, Metadata)
    VALUES (@odontograma1, 2, 'seed', @parentVersion1, 0, '{"fase":"seguimiento"}');
END

IF NOT EXISTS (SELECT 1 FROM dbo.OdontogramaVersion WHERE OdontogramaId = @odontograma2 AND VersionNumber = 1)
BEGIN
    INSERT INTO dbo.OdontogramaVersion (OdontogramaId, VersionNumber, Usuario_Creacion, Locked, Metadata)
    VALUES (@odontograma2, 1, 'seed', 0, '{"fase":"control"}');
END

DECLARE @version1 INT = (SELECT TOP 1 Id FROM dbo.OdontogramaVersion WHERE OdontogramaId = @odontograma1 AND VersionNumber = 1 ORDER BY Id);
DECLARE @version1b INT = (SELECT TOP 1 Id FROM dbo.OdontogramaVersion WHERE OdontogramaId = @odontograma1 AND VersionNumber = 2 ORDER BY Id);
DECLARE @version2 INT = (SELECT TOP 1 Id FROM dbo.OdontogramaVersion WHERE OdontogramaId = @odontograma2 AND VersionNumber = 1 ORDER BY Id);

INSERT INTO dbo.Diente (OdontogramaId, Nro_Historia, NumeroDiente, EstadoCodigo, Estado, Color, Observaciones, Tiene_Protesis, Metadata, Usuario_Creacion)
SELECT @odontograma1, '1001', 11, 'BUENO', 'Sano', '#4CAF50', 'Diente 11 sin alteraciones', 0, '{"estado":"normal"}', 'seed'
WHERE NOT EXISTS (SELECT 1 FROM dbo.Diente WHERE OdontogramaId = @odontograma1 AND NumeroDiente = 11);

INSERT INTO dbo.Diente (OdontogramaId, Nro_Historia, NumeroDiente, EstadoCodigo, Estado, Color, Observaciones, Tiene_Protesis, Metadata, Usuario_Creacion)
SELECT @odontograma1, '1001', 16, 'CARIES', 'Caries inicial', '#F44336', 'Caries en oclusal', 0, '{"estado":"caries"}', 'seed'
WHERE NOT EXISTS (SELECT 1 FROM dbo.Diente WHERE OdontogramaId = @odontograma1 AND NumeroDiente = 16);

INSERT INTO dbo.Diente (OdontogramaId, Nro_Historia, NumeroDiente, EstadoCodigo, Estado, Color, Observaciones, Tiene_Protesis, Metadata, Usuario_Creacion)
SELECT @odontograma1, '1001', 26, 'ENDODONCIA', 'Endodoncia previa', '#9C27B0', 'Conductos tratados', 1, '{"estado":"endodoncia"}', 'seed'
WHERE NOT EXISTS (SELECT 1 FROM dbo.Diente WHERE OdontogramaId = @odontograma1 AND NumeroDiente = 26);

INSERT INTO dbo.Diente (OdontogramaId, Nro_Historia, NumeroDiente, EstadoCodigo, Estado, Color, Observaciones, Tiene_Protesis, Metadata, Usuario_Creacion)
SELECT @odontograma2, '1002', 21, 'BUENO', 'Sano', '#4CAF50', 'Diente 21 en buen estado', 0, '{"estado":"normal"}', 'seed'
WHERE NOT EXISTS (SELECT 1 FROM dbo.Diente WHERE OdontogramaId = @odontograma2 AND NumeroDiente = 21);

INSERT INTO dbo.Diente (OdontogramaId, Nro_Historia, NumeroDiente, EstadoCodigo, Estado, Color, Observaciones, Tiene_Protesis, Metadata, Usuario_Creacion)
SELECT @odontograma2, '1002', 36, 'EXTRACCION', 'Indicador de extracción', '#795548', 'Diente en proceso de extracción', 0, '{"estado":"extraccion"}', 'seed'
WHERE NOT EXISTS (SELECT 1 FROM dbo.Diente WHERE OdontogramaId = @odontograma2 AND NumeroDiente = 36);

INSERT INTO dbo.DienteArea (OdontogramaId, Nro_Historia, NumeroDiente, Area, Estado, Color, Observaciones, Metadata, Usuario_Creacion)
SELECT @odontograma1, '1001', 11, 'oclusal', 'presente', '#4CAF50', 'Área oclusal intacta', '{"area":"oclusal"}', 'seed'
WHERE NOT EXISTS (SELECT 1 FROM dbo.DienteArea WHERE OdontogramaId = @odontograma1 AND NumeroDiente = 11 AND Area = 'oclusal');

INSERT INTO dbo.DienteArea (OdontogramaId, Nro_Historia, NumeroDiente, Area, Estado, Color, Observaciones, Metadata, Usuario_Creacion)
SELECT @odontograma1, '1001', 16, 'vestibular', 'caries', '#F44336', 'Caries vestibular visible', '{"area":"vestibular"}', 'seed'
WHERE NOT EXISTS (SELECT 1 FROM dbo.DienteArea WHERE OdontogramaId = @odontograma1 AND NumeroDiente = 16 AND Area = 'vestibular');

INSERT INTO dbo.DienteArea (OdontogramaId, Nro_Historia, NumeroDiente, Area, Estado, Color, Observaciones, Metadata, Usuario_Creacion)
SELECT @odontograma2, '1002', 36, 'mesial', 'explotado', '#795548', 'Área mesial comprometida', '{"area":"mesial"}', 'seed'
WHERE NOT EXISTS (SELECT 1 FROM dbo.DienteArea WHERE OdontogramaId = @odontograma2 AND NumeroDiente = 36 AND Area = 'mesial');

INSERT INTO dbo.DienteCodigo (OdontogramaId, Nro_Historia, NumeroDiente, Codigo, Descripcion, Color, Metadata, Usuario_Creacion)
SELECT @odontograma1, '1001', 11, 'PULPOTOMIA', 'Tratamiento de pulpa', '#4CAF50', '{"codigo":"PULPOTOMIA"}', 'seed'
WHERE NOT EXISTS (SELECT 1 FROM dbo.DienteCodigo WHERE OdontogramaId = @odontograma1 AND NumeroDiente = 11 AND Codigo = 'PULPOTOMIA');

INSERT INTO dbo.DienteCodigo (OdontogramaId, Nro_Historia, NumeroDiente, Codigo, Descripcion, Color, Metadata, Usuario_Creacion)
SELECT @odontograma1, '1001', 16, 'CARI1', 'Caries inicial', '#F44336', '{"codigo":"CARI1"}', 'seed'
WHERE NOT EXISTS (SELECT 1 FROM dbo.DienteCodigo WHERE OdontogramaId = @odontograma1 AND NumeroDiente = 16 AND Codigo = 'CARI1');

INSERT INTO dbo.DienteCodigo (OdontogramaId, Nro_Historia, NumeroDiente, Codigo, Descripcion, Color, Metadata, Usuario_Creacion)
SELECT @odontograma2, '1002', 36, 'EXT', 'Extracción indicada', '#795548', '{"codigo":"EXT"}', 'seed'
WHERE NOT EXISTS (SELECT 1 FROM dbo.DienteCodigo WHERE OdontogramaId = @odontograma2 AND NumeroDiente = 36 AND Codigo = 'EXT');

INSERT INTO dbo.Transposicion (OdontogramaId, Nro_Historia, Diente_From, Diente_To, Color, Observaciones, Metadata, Usuario_Creacion)
SELECT @odontograma1, '1001', 11, 12, '#2196F3', 'Posible transposición', '{"tipo":"transposicion"}', 'seed'
WHERE NOT EXISTS (SELECT 1 FROM dbo.Transposicion WHERE OdontogramaId = @odontograma1 AND Diente_From = 11 AND Diente_To = 12);

IF NOT EXISTS (SELECT 1 FROM dbo.Protesis WHERE OdontogramaId = @odontograma1 AND Tipo = 'corona')
BEGIN
    INSERT INTO dbo.Protesis (OdontogramaId, Nro_Historia, Tipo, SubTipo, Posicion, Color, Observaciones, Metadata, Usuario_Creacion)
    VALUES (@odontograma1, '1001', 'corona', 'porcelana', 'superior', '#FFFFFF', 'Corona provisional', '{"tipo":"corona"}', 'seed');
END

IF NOT EXISTS (SELECT 1 FROM dbo.Protesis WHERE OdontogramaId = @odontograma2 AND Tipo = 'implante')
BEGIN
    INSERT INTO dbo.Protesis (OdontogramaId, Nro_Historia, Tipo, SubTipo, Posicion, Color, Observaciones, Metadata, Usuario_Creacion)
    VALUES (@odontograma2, '1002', 'implante', 'unitario', 'inferior', '#BDBDBD', 'Prótesis de implante', '{"tipo":"implante"}', 'seed');
END

DECLARE @protesis1 INT = (SELECT TOP 1 Id FROM dbo.Protesis WHERE OdontogramaId = @odontograma1 AND Tipo = 'corona' ORDER BY Id);
DECLARE @protesis2 INT = (SELECT TOP 1 Id FROM dbo.Protesis WHERE OdontogramaId = @odontograma2 AND Tipo = 'implante' ORDER BY Id);

INSERT INTO dbo.ProtesisTeeth (ProtesisId, NumeroDiente, Posicion)
SELECT @protesis1, 26, 'superior'
WHERE NOT EXISTS (SELECT 1 FROM dbo.ProtesisTeeth WHERE ProtesisId = @protesis1 AND NumeroDiente = 26);

INSERT INTO dbo.ProtesisTeeth (ProtesisId, NumeroDiente, Posicion)
SELECT @protesis2, 36, 'inferior'
WHERE NOT EXISTS (SELECT 1 FROM dbo.ProtesisTeeth WHERE ProtesisId = @protesis2 AND NumeroDiente = 36);

INSERT INTO dbo.Restauracion (OdontogramaVersionId, NumeroDiente, Tipo, Material, Areas, Color, Metadata, Usuario_Creacion)
SELECT @version1, 16, 'temporal', 'resina', 'oclusal,vestibular', '#FF9800', '{"tipo":"restauracion"}', 'seed'
WHERE NOT EXISTS (SELECT 1 FROM dbo.Restauracion WHERE OdontogramaVersionId = @version1 AND NumeroDiente = 16);

INSERT INTO dbo.Restauracion (OdontogramaVersionId, NumeroDiente, Tipo, Material, Areas, Color, Metadata, Usuario_Creacion)
SELECT @version2, 21, 'definitiva', 'cerámica', 'mesial,distal', '#8BC34A', '{"tipo":"restauracion"}', 'seed'
WHERE NOT EXISTS (SELECT 1 FROM dbo.Restauracion WHERE OdontogramaVersionId = @version2 AND NumeroDiente = 21);

INSERT INTO dbo.Endodoncia (OdontogramaVersionId, NumeroDiente, Conductos, Estado, Color, Metadata, Usuario_Creacion)
SELECT @version1, 26, 3, 'completa', '#9C27B0', '{"tipo":"endodoncia"}', 'seed'
WHERE NOT EXISTS (SELECT 1 FROM dbo.Endodoncia WHERE OdontogramaVersionId = @version1 AND NumeroDiente = 26);

INSERT INTO dbo.Implante (OdontogramaVersionId, NumeroDiente, DiametroMM, LongitudMM, Sistema, Material, Color, Metadata, Usuario_Creacion)
SELECT @version1b, 36, 4.20, 10.0, 'Nobel', 'titanio', '#BDBDBD', '{"tipo":"implante"}', 'seed'
WHERE NOT EXISTS (SELECT 1 FROM dbo.Implante WHERE OdontogramaVersionId = @version1b AND NumeroDiente = 36);

INSERT INTO dbo.Fractura (OdontogramaVersionId, NumeroDiente, Tipo, Severidad, Color, Metadata, Usuario_Creacion)
SELECT @version2, 21, 'vertical', 'media', '#FF5722', '{"tipo":"fractura"}', 'seed'
WHERE NOT EXISTS (SELECT 1 FROM dbo.Fractura WHERE OdontogramaVersionId = @version2 AND NumeroDiente = 21 AND Tipo = 'vertical');

COMMIT TRANSACTION;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    THROW;
END CATCH;

SELECT 'Odontograma' AS tabla, COUNT(*) AS filas FROM dbo.Odontograma
UNION ALL
SELECT 'OdontogramaVersion', COUNT(*) FROM dbo.OdontogramaVersion
UNION ALL
SELECT 'Diente', COUNT(*) FROM dbo.Diente
UNION ALL
SELECT 'DienteArea', COUNT(*) FROM dbo.DienteArea
UNION ALL
SELECT 'DienteCodigo', COUNT(*) FROM dbo.DienteCodigo
UNION ALL
SELECT 'Transposicion', COUNT(*) FROM dbo.Transposicion
UNION ALL
SELECT 'Protesis', COUNT(*) FROM dbo.Protesis
UNION ALL
SELECT 'ProtesisTeeth', COUNT(*) FROM dbo.ProtesisTeeth
UNION ALL
SELECT 'Restauracion', COUNT(*) FROM dbo.Restauracion
UNION ALL
SELECT 'Endodoncia', COUNT(*) FROM dbo.Endodoncia
UNION ALL
SELECT 'Implante', COUNT(*) FROM dbo.Implante
UNION ALL
SELECT 'Fractura', COUNT(*) FROM dbo.Fractura;
