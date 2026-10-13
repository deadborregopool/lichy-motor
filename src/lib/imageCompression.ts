import imageCompression from 'browser-image-compression';

export async function comprimirImagen(file: File): Promise<File> {
  const options = {
    maxSizeMB: 0.1, // Máximo ~100 KB
    maxWidthOrHeight: 800, // Dimensión óptima para catálogo de repuestos
    useWebWorker: true,
    fileType: 'image/webp'
  };

  try {
    const compressedBlob = await imageCompression(file, options);
    // Preservar el nombre con extensión .webp
    const nuevoNombre = file.name.replace(/\.[^/.]+$/, "") + ".webp";
    return new File([compressedBlob], nuevoNombre, { type: 'image/webp' });
  } catch (error) {
    console.error('Error al comprimir imagen, usando archivo original:', error);
    return file;
  }
}
