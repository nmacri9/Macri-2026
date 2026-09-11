import { Injectable } from '@angular/core';
import { SupabaseClient } from '@supabase/supabase-js';

export interface FotoPerfilSubida {
  url: string;
  ruta: string;
}

@Injectable({ providedIn: 'root' })
export class FotosPerfilService {
  private readonly bucket = 'productos';

  async subir(client: SupabaseClient, clienteId: string, dataUrl: string): Promise<FotoPerfilSubida> {
    const archivo = this.dataUrlAFile(dataUrl);
    const extension = this.extensionPara(archivo.type);
    const ruta = `perfiles/${clienteId}/${crypto.randomUUID()}.${extension}`;
    const { error } = await client.storage.from(this.bucket).upload(ruta, archivo, {
      cacheControl: '3600',
      upsert: false
    });
    if (error) throw error;

    const { data } = client.storage.from(this.bucket).getPublicUrl(ruta);
    if (!data.publicUrl) {
      await this.eliminar(client, ruta);
      throw new Error('No se pudo obtener la URL pública de la foto.');
    }
    return { url: data.publicUrl, ruta };
  }

  async eliminar(client: SupabaseClient, ruta: string): Promise<void> {
    const { error } = await client.storage.from(this.bucket).remove([ruta]);
    if (error) throw error;
  }

  private dataUrlAFile(dataUrl: string): File {
    const partes = dataUrl.split(',');
    const mime = partes[0]?.match(/data:(.*?);base64/)?.[1];
    if (!mime || !partes[1]) throw new Error('La foto seleccionada no es válida.');

    const binario = atob(partes[1]);
    const bytes = new Uint8Array(binario.length);
    for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
    return new File([bytes], `perfil.${this.extensionPara(mime)}`, { type: mime });
  }

  private extensionPara(mime: string): string {
    if (mime === 'image/png') return 'png';
    if (mime === 'image/webp') return 'webp';
    return 'jpg';
  }
}
