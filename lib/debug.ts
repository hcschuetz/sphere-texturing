export const log = <T>(label: string, value: T): T => {
  console.log(label, value);
  return value;
}