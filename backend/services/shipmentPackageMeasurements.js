const measurementDefinitions = {
  packageWeightKg: {
    label: 'Package weight',
    precision: 8,
    scale: 3,
    minimumExclusive: 0n,
  },
  packageLengthCm: {
    label: 'Package length',
    precision: 8,
    scale: 2,
    minimumExclusive: 50n,
  },
  packageBreadthCm: {
    label: 'Package breadth',
    precision: 8,
    scale: 2,
    minimumExclusive: 50n,
  },
  packageHeightCm: {
    label: 'Package height',
    precision: 8,
    scale: 2,
    minimumExclusive: 50n,
  },
}

export const shipmentPackageMeasurementFields = Object.freeze(
  Object.keys(measurementDefinitions),
)

const parseMeasurement = (value, field, definition) => {
  if (typeof value !== 'string' || value.length > 32 || !/^\d+(?:\.\d+)?$/.test(value)) {
    throw new TypeError(`${definition.label} must be a decimal string.`)
  }

  const [whole, fraction = ''] = value.split('.')
  if (fraction.length > definition.scale) {
    throw new TypeError(`${definition.label} has too many decimal places.`)
  }

  const significantWhole = whole.replace(/^0+(?=\d)/, '')
  if (significantWhole.length > definition.precision - definition.scale) {
    throw new TypeError(`${definition.label} exceeds the supported range.`)
  }

  const scaledValue = (
    BigInt(significantWhole) * (10n ** BigInt(definition.scale))
    + BigInt(fraction.padEnd(definition.scale, '0') || '0')
  )
  const maximum = (10n ** BigInt(definition.precision)) - 1n
  if (scaledValue > maximum) {
    throw new TypeError(`${definition.label} exceeds the supported range.`)
  }
  if (scaledValue <= definition.minimumExclusive) {
    const requirement = field === 'packageWeightKg' ? 'greater than zero' : 'greater than 0.5 cm'
    throw new TypeError(`${definition.label} must be ${requirement}.`)
  }

  return `${significantWhole}${fraction ? `.${fraction}` : ''}`
}

export const validateShipmentPackageMeasurements = (measurements) => {
  if (!measurements || typeof measurements !== 'object' || Array.isArray(measurements)) {
    throw new TypeError('Package measurements are required.')
  }

  return Object.fromEntries(
    shipmentPackageMeasurementFields.map((field) => [
      field,
      parseMeasurement(measurements[field], field, measurementDefinitions[field]),
    ]),
  )
}
