CREATE DATABASE  IF NOT EXISTS `pizzeria_db` /*!40100 DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci */ /*!80016 DEFAULT ENCRYPTION='N' */;
USE `pizzeria_db`;
-- MySQL dump 10.13  Distrib 8.0.44, for Win64 (x86_64)
--
-- Host: localhost    Database: pizzeria_db
-- ------------------------------------------------------
-- Server version	8.0.44

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `articulo`
--

DROP TABLE IF EXISTS `articulo`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `articulo` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nombre` varchar(100) NOT NULL,
  `tipo` enum('MATERIA_PRIMA','SEMI_ELABORADO','PLATO_FINAL') NOT NULL,
  `unidad_medida` varchar(20) NOT NULL,
  `stock_actual` decimal(10,3) DEFAULT '0.000',
  `stock_minimo` decimal(10,3) DEFAULT '0.000',
  `precio_venta` decimal(10,2) DEFAULT NULL,
  `email_proveedor` varchar(255) NOT NULL DEFAULT 'No definido',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=27 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `articulo`
--

LOCK TABLES `articulo` WRITE;
/*!40000 ALTER TABLE `articulo` DISABLE KEYS */;
INSERT INTO `articulo` VALUES (1,'Harina 0000','MATERIA_PRIMA','kg',18.250,15.000,0.00,'mejiasjohannys@gmail.com'),(2,'Levadura fresca','MATERIA_PRIMA','kg',0.730,0.200,0.00,'mejiasjohannys@gmail.com'),(3,'Agua','MATERIA_PRIMA','litros',80.950,20.000,0.00,'mejiasjohannys@gmail.com'),(4,'Sal fina','MATERIA_PRIMA','kg',4.115,1.000,0.00,'mejiasjohannys@gmail.com'),(5,'Aceite de Girasol','MATERIA_PRIMA','litros',8.730,3.000,0.00,'mejiasjohannys@gmail.com'),(6,'Tomate Maduro','MATERIA_PRIMA','unidades',50.000,40.000,0.00,'mejiasjohannys@gmail.com'),(7,'Queso Muzzarella','MATERIA_PRIMA','kg',7.600,10.000,0.00,'mejiasjohannys@gmail.com'),(8,'Aceitunas Verdes','MATERIA_PRIMA','unidades',200.000,200.000,0.00,'mejiasjohannys@gmail.com'),(9,'Orégano','MATERIA_PRIMA','kg',0.625,0.200,0.00,'mejiasjohannys@gmail.com'),(10,'Cebolla','MATERIA_PRIMA','kg',13.500,5.000,0.00,'mejiasjohannys@gmail.com'),(11,'Queso Parmesano Rallado','MATERIA_PRIMA','kg',4.850,1.500,0.00,'mejiasjohannys@gmail.com'),(12,'Tomate Redondo','MATERIA_PRIMA','kg',10.000,3.000,0.00,'mejiasjohannys@gmail.com'),(13,'Cabezas de Ajo Fresco','MATERIA_PRIMA','kg',2.000,0.500,0.00,'mejiasjohannys@gmail.com'),(14,'Pepperoni','MATERIA_PRIMA','kg',5.000,1.500,0.00,'mejiasjohannys@gmail.com'),(15,'Jamón Cocido','MATERIA_PRIMA','kg',10.000,2.000,0.00,'mejiasjohannys@gmail.com'),(16,'Morrones en Conserva','MATERIA_PRIMA','kg',8.000,2.000,0.00,'mejiasjohannys@gmail.com'),(17,'Aceite de Oliva','MATERIA_PRIMA','litros',3.750,1.000,0.00,'mejiasjohannys@gmail.com'),(18,'Albahaca Fresca','MATERIA_PRIMA','kg',0.125,0.100,0.00,'mejiasjohannys@gmail.com'),(19,'Prepizza','SEMI_ELABORADO','unidades',2.000,20.000,0.00,'No definido'),(20,'Salsa de Tomate para Pizza','SEMI_ELABORADO','kg',7.000,3.000,0.00,'No definido'),(21,'Ajo Picado','SEMI_ELABORADO','kg',0.000,0.500,0.00,'No definido'),(22,'Pizza de Muzzarella','PLATO_FINAL','unidades',0.000,0.000,8000.00,'No definido'),(23,'Pizza Fugazzeta','PLATO_FINAL','unidades',0.000,0.000,9500.00,'No definido'),(24,'Pizza Napolitana','PLATO_FINAL','unidades',0.000,0.000,9500.00,'No definido'),(25,'Pizza de Pepperoni','PLATO_FINAL','unidades',0.000,0.000,10000.00,'No definido'),(26,'Pizza de Jamón y Morrones','PLATO_FINAL','unidades',0.000,0.000,10500.00,'No definido');
/*!40000 ALTER TABLE `articulo` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `produccion_log`
--

DROP TABLE IF EXISTS `produccion_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `produccion_log` (
  `id` int NOT NULL AUTO_INCREMENT,
  `semi_id` int DEFAULT NULL,
  `cantidad` int NOT NULL,
  `fecha` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `semi_id` (`semi_id`),
  CONSTRAINT `produccion_log_ibfk_1` FOREIGN KEY (`semi_id`) REFERENCES `articulo` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=26 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `produccion_log`
--

LOCK TABLES `produccion_log` WRITE;
/*!40000 ALTER TABLE `produccion_log` DISABLE KEYS */;
INSERT INTO `produccion_log` VALUES (1,19,20,'2026-05-24 23:52:16'),(2,20,1,'2026-05-24 23:52:29'),(3,19,20,'2026-05-24 23:53:41'),(4,20,3,'2026-05-24 23:53:53'),(5,20,2,'2026-05-24 23:54:02'),(6,19,10,'2026-05-25 00:01:10'),(7,20,3,'2026-05-25 00:01:31'),(8,19,10,'2026-05-25 00:53:05'),(9,20,1,'2026-05-25 00:53:38'),(10,19,20,'2026-05-25 00:53:49'),(11,20,2,'2026-05-25 00:54:30'),(12,19,35,'2026-05-25 00:55:29'),(13,20,13,'2026-05-25 00:58:28'),(14,19,1,'2026-05-25 01:00:26'),(15,19,1,'2026-05-25 01:01:47'),(16,19,1,'2026-05-25 01:16:01'),(17,19,1,'2026-05-25 01:20:53'),(18,19,1,'2026-05-25 01:22:33'),(19,19,1,'2026-05-25 01:23:47'),(20,19,1,'2026-05-25 01:25:45'),(21,19,1,'2026-05-25 01:34:47'),(22,19,1,'2026-05-25 01:35:23'),(23,19,1,'2026-05-25 01:47:40'),(24,19,1,'2026-05-25 01:48:02'),(25,19,1,'2026-05-25 01:50:33');
/*!40000 ALTER TABLE `produccion_log` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `receta`
--

DROP TABLE IF EXISTS `receta`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `receta` (
  `producto_id` int NOT NULL,
  `ingrediente_id` int NOT NULL,
  `cantidad` decimal(10,3) NOT NULL,
  PRIMARY KEY (`producto_id`,`ingrediente_id`),
  KEY `ingrediente_id` (`ingrediente_id`),
  CONSTRAINT `receta_ibfk_1` FOREIGN KEY (`producto_id`) REFERENCES `articulo` (`id`) ON DELETE CASCADE,
  CONSTRAINT `receta_ibfk_2` FOREIGN KEY (`ingrediente_id`) REFERENCES `articulo` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `receta`
--

LOCK TABLES `receta` WRITE;
/*!40000 ALTER TABLE `receta` DISABLE KEYS */;
INSERT INTO `receta` VALUES (19,1,0.250),(19,2,0.010),(19,3,0.150),(19,4,0.005),(19,5,0.010),(20,4,0.010),(20,6,8.000),(20,9,0.005),(20,17,0.050),(20,18,0.015),(21,13,1.000),(22,7,0.300),(22,8,8.000),(22,9,0.002),(22,19,1.000),(22,20,0.150),(23,7,0.400),(23,8,8.000),(23,9,0.002),(23,10,0.300),(23,11,0.030),(23,19,1.000),(24,7,0.300),(24,8,8.000),(24,11,0.020),(24,12,0.250),(24,19,1.000),(24,20,0.100),(24,21,0.010),(25,7,0.300),(25,14,0.150),(25,19,1.000),(25,20,0.150),(26,7,0.300),(26,8,8.000),(26,15,0.200),(26,16,0.150),(26,19,1.000),(26,20,0.150);
/*!40000 ALTER TABLE `receta` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `venta`
--

DROP TABLE IF EXISTS `venta`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `venta` (
  `id` int NOT NULL AUTO_INCREMENT,
  `fecha` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `total` decimal(10,2) DEFAULT '0.00',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=17 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `venta`
--

LOCK TABLES `venta` WRITE;
/*!40000 ALTER TABLE `venta` DISABLE KEYS */;
INSERT INTO `venta` VALUES (1,'2026-05-24 23:52:56',160000.00),(2,'2026-05-24 23:55:14',160000.00),(3,'2026-05-25 00:02:42',87500.00),(4,'2026-05-25 00:54:16',80000.00),(5,'2026-05-25 00:55:16',160000.00),(6,'2026-05-25 00:58:51',280000.00),(7,'2026-05-25 01:00:42',8000.00),(8,'2026-05-25 01:01:53',8000.00),(9,'2026-05-25 01:16:07',8000.00),(10,'2026-05-25 01:21:10',8000.00),(11,'2026-05-25 01:22:43',8000.00),(12,'2026-05-25 01:23:53',8000.00),(13,'2026-05-25 01:26:01',8000.00),(14,'2026-05-25 01:35:02',8000.00),(15,'2026-05-25 01:35:43',8000.00),(16,'2026-05-25 01:50:54',8000.00);
/*!40000 ALTER TABLE `venta` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `venta_detalle`
--

DROP TABLE IF EXISTS `venta_detalle`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `venta_detalle` (
  `id` int NOT NULL AUTO_INCREMENT,
  `venta_id` int DEFAULT NULL,
  `plato_id` int DEFAULT NULL,
  `cantidad` int NOT NULL,
  PRIMARY KEY (`id`),
  KEY `venta_id` (`venta_id`),
  KEY `plato_id` (`plato_id`),
  CONSTRAINT `venta_detalle_ibfk_1` FOREIGN KEY (`venta_id`) REFERENCES `venta` (`id`) ON DELETE CASCADE,
  CONSTRAINT `venta_detalle_ibfk_2` FOREIGN KEY (`plato_id`) REFERENCES `articulo` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=18 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `venta_detalle`
--

LOCK TABLES `venta_detalle` WRITE;
/*!40000 ALTER TABLE `venta_detalle` DISABLE KEYS */;
INSERT INTO `venta_detalle` VALUES (1,1,22,20),(2,2,22,20),(3,3,23,5),(4,3,22,5),(5,4,22,10),(6,5,22,20),(7,6,22,35),(8,7,22,1),(9,8,22,1),(10,9,22,1),(11,10,22,1),(12,11,22,1),(13,12,22,1),(14,13,22,1),(15,14,22,1),(16,15,22,1),(17,16,22,1);
/*!40000 ALTER TABLE `venta_detalle` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping routines for database 'pizzeria_db'
--
/*!50003 DROP PROCEDURE IF EXISTS `registrar_produccion` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
CREATE DEFINER=`root`@`localhost` PROCEDURE `registrar_produccion`(
    IN p_semi_id INT, 
    IN p_cantidad INT
)
BEGIN
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Error al registrar la producción.';
    END;

    START TRANSACTION;
    
    -- 1. Log de producción
    INSERT INTO produccion_log (semi_id, cantidad) 
    VALUES (p_semi_id, p_cantidad);

    -- 2. Sumo el stock de lo que acabo de cocinar (ej: +10 Prepizzas)
    UPDATE articulo 
    SET stock_actual = stock_actual + p_cantidad 
    WHERE id = p_semi_id;

    -- 3. Descuento TODO lo que diga su receta (Harina, levadura, etc)
    UPDATE articulo a
    JOIN receta r ON a.id = r.ingrediente_id
    SET a.stock_actual = a.stock_actual - (r.cantidad * p_cantidad)
    WHERE r.producto_id = p_semi_id;

    COMMIT;
END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 DROP PROCEDURE IF EXISTS `registrar_venta_detalle` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
CREATE DEFINER=`root`@`localhost` PROCEDURE `registrar_venta_detalle`(
    IN p_venta_id INT, 
    IN p_plato_id INT, 
    IN p_cantidad INT
)
BEGIN
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Error al registrar la venta.';
    END;

    START TRANSACTION;

    -- 1. Registro el detalle de la venta
    INSERT INTO venta_detalle (venta_id, plato_id, cantidad) 
    VALUES (p_venta_id, p_plato_id, p_cantidad);

    -- 2. Descuento TODOS los ingredientes directos del plato de una sola vez
    UPDATE articulo a
    JOIN receta r ON a.id = r.ingrediente_id
    SET a.stock_actual = a.stock_actual - (r.cantidad * p_cantidad)
    WHERE r.producto_id = p_plato_id;

    COMMIT;
END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-05-24 23:05:59
