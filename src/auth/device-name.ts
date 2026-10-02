import * as Device from 'expo-device';

/**
 * device_name for POST /login, e.g. "Samsung SM-A546E" or "Google Pixel 7".
 * The server shows it later in the user's device list.
 */
export function getDeviceName(): string {
  const brand = (Device.brand ?? Device.manufacturer ?? '').trim();
  const model = (Device.modelName ?? '').trim();

  let name: string;
  if (brand && model) {
    name = model.toLowerCase().startsWith(brand.toLowerCase()) ? model : `${capitalize(brand)} ${model}`;
  } else {
    name = model || capitalize(brand) || Device.deviceName?.trim() || 'Android phone';
  }
  return name.slice(0, 255);
}

function capitalize(value: string): string {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : value;
}
