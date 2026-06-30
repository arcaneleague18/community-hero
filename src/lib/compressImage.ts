export const compressImage = (base64Str: string, maxWidth = 512, maxHeight = 512, quality = 0.5): Promise<string> => {
  return new Promise((resolve) => {
    // Return original if it's not an image (e.g. video)
    if (!base64Str.startsWith('data:image')) {
      resolve(base64Str);
      return;
    }
    
    let img = new Image();
    img.src = base64Str;
    img.onload = () => {
      let canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }
      if (height > maxHeight) {
        width = Math.round((width * maxHeight) / height);
        height = maxHeight;
      }

      canvas.width = width;
      canvas.height = height;
      let ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => {
      resolve(base64Str); // fallback to original
    }
  });
};
