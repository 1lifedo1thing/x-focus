interface StorageChanges {
  [key: string]: { newValue?: string | number | boolean }
}

interface NewData {
  [key: string]: string | number | boolean | undefined
}

export default function constructNewData(changes: StorageChanges): NewData {
  return Object.fromEntries(
    Object.entries(changes).map(([key, item]) => [key, item?.newValue]),
  )
}
