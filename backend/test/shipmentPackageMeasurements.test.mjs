import assert from 'node:assert/strict'
import { test } from 'node:test'
import { validateShipmentPackageMeasurements } from '../services/shipmentPackageMeasurements.js'

const validMeasurements = {
  packageWeightKg: '1.234',
  packageLengthCm: '10.25',
  packageBreadthCm: '8.5',
  packageHeightCm: '3',
}

test('accepts valid positive measurements and preserves normalized decimal strings', () => {
  assert.deepEqual(
    validateShipmentPackageMeasurements(validMeasurements),
    validMeasurements,
  )
})

test('normalizes leading zeroes without changing decimal precision', () => {
  assert.deepEqual(
    validateShipmentPackageMeasurements({
      packageWeightKg: '0001.200',
      packageLengthCm: '00010.20',
      packageBreadthCm: '0008.50',
      packageHeightCm: '0003',
    }),
    {
      packageWeightKg: '1.200',
      packageLengthCm: '10.20',
      packageBreadthCm: '8.50',
      packageHeightCm: '3',
    },
  )
})

test('accepts maximum decimal scales and rejects excess precision for each measurement', async (t) => {
  const maximumScale = {
    packageWeightKg: '0.001',
    packageLengthCm: '0.51',
    packageBreadthCm: '0.51',
    packageHeightCm: '0.51',
  }
  assert.deepEqual(validateShipmentPackageMeasurements(maximumScale), maximumScale)

  for (const [field, value] of Object.entries({
    packageWeightKg: '1.0001',
    packageLengthCm: '1.001',
    packageBreadthCm: '1.001',
    packageHeightCm: '1.001',
  })) {
    await t.test(`${field} rejects excess decimal places`, () => {
      assert.throws(
        () => validateShipmentPackageMeasurements({ ...validMeasurements, [field]: value }),
        { name: 'TypeError', message: /too many decimal places/ },
      )
    })
  }
})

test('rejects missing measurement objects and omitted fields', () => {
  for (const value of [undefined, null, [], 'measurements']) {
    assert.throws(() => validateShipmentPackageMeasurements(value), {
      name: 'TypeError',
      message: 'Package measurements are required.',
    })
  }

  for (const field of Object.keys(validMeasurements)) {
    const incomplete = { ...validMeasurements }
    delete incomplete[field]
    assert.throws(() => validateShipmentPackageMeasurements(incomplete), {
      name: 'TypeError',
      message: /must be a decimal string/,
    })
  }
})

test('rejects null and empty measurement values', async (t) => {
  for (const value of [null, '']) {
    await t.test(`rejects ${String(value)}`, () => {
      assert.throws(
        () => validateShipmentPackageMeasurements({ ...validMeasurements, packageWeightKg: value }),
        { name: 'TypeError', message: 'Package weight must be a decimal string.' },
      )
    })
  }
})

test('rejects zero, negative, malformed and non-finite numeric values', async (t) => {
  const invalidValues = [
    ['zero weight', 'packageWeightKg', '0'],
    ['zero dimension', 'packageLengthCm', '0'],
    ['dimension at minimum boundary', 'packageBreadthCm', '0.50'],
    ['negative value', 'packageHeightCm', '-1'],
    ['signed positive value', 'packageWeightKg', '+1'],
    ['malformed decimal', 'packageLengthCm', '1.2.3'],
    ['whitespace', 'packageBreadthCm', ' 1.25'],
    ['NaN', 'packageWeightKg', Number.NaN],
    ['positive infinity', 'packageLengthCm', Number.POSITIVE_INFINITY],
    ['negative infinity', 'packageHeightCm', Number.NEGATIVE_INFINITY],
  ]

  for (const [label, field, value] of invalidValues) {
    await t.test(label, () => {
      assert.throws(
        () => validateShipmentPackageMeasurements({ ...validMeasurements, [field]: value }),
        { name: 'TypeError' },
      )
    })
  }
})

test('accepts the schema maximum and rejects values outside supported precision ranges', async (t) => {
  const maximums = {
    packageWeightKg: '99999.999',
    packageLengthCm: '999999.99',
    packageBreadthCm: '999999.99',
    packageHeightCm: '999999.99',
  }
  assert.deepEqual(validateShipmentPackageMeasurements(maximums), maximums)

  for (const [field, value] of Object.entries({
    packageWeightKg: '100000',
    packageLengthCm: '1000000',
    packageBreadthCm: '1000000',
    packageHeightCm: '1000000',
  })) {
    await t.test(`${field} rejects values beyond Decimal(8, scale)`, () => {
      assert.throws(
        () => validateShipmentPackageMeasurements({ ...validMeasurements, [field]: value }),
        { name: 'TypeError', message: /exceeds the supported range/ },
      )
    })
  }
})

test('rejects measurement strings longer than the accepted input limit', () => {
  assert.throws(
    () => validateShipmentPackageMeasurements({
      ...validMeasurements,
      packageWeightKg: '1'.repeat(33),
    }),
    { name: 'TypeError', message: /must be a decimal string/ },
  )
})
