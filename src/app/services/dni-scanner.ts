import { Injectable } from '@angular/core';
import { BarcodeScanner } from '@capacitor-mlkit/barcode-scanning';

@Injectable({
  providedIn: 'root'
})
export class DniScannerService {

  constructor() { }

  // Recibe una función opcional para avisar si está instalando el módulo
  async escanear(onInstalar?: () => void) {
    // 1. Verificamos e instalamos el módulo de Google Play 
    const { available } = await BarcodeScanner.isGoogleBarcodeScannerModuleAvailable();
    if (!available) {
      if (onInstalar) onInstalar(); // Le avisa a la vista que espere
      await BarcodeScanner.installGoogleBarcodeScannerModule();
    }

    // 2. Pedimos permisos y validamos explícitamente
    const permissions = await BarcodeScanner.requestPermissions();
    if (permissions.camera !== 'granted' && permissions.camera !== 'limited') {
      throw new Error('Permiso de cámara denegado por el usuario.');
    }

    // 3. Ejecutamos el escáner
    const result = await BarcodeScanner.scan();
    const rawData = result.barcodes[0].rawValue;
    
    if (!rawData) throw new Error('No se pudo leer el código');

    // 4. Parseamos los datos
    const partes = rawData.split('@');
    if (partes.length < 5) {
      throw new Error('Formato de DNI inválido');
    }

    // 5. Devolvemos el objeto limpio (con la capitalización que armó tu compañero)
    return {
      apellidos: partes[1].charAt(0) + partes[1].slice(1).toLowerCase(),
      nombres: partes[2].charAt(0) + partes[2].slice(1).toLowerCase(),
      sexo: partes[3], // Por si vos lo necesitas en tu pantalla
      dni: partes[4],
      ejemplar: partes[5], // Por si lo necesitan
      fechaNacimiento: partes[6] // Por si lo necesitan (Formato DD/MM/YYYY)
    };
  }
}