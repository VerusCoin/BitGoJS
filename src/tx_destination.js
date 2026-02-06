var varuint = require('varuint-bitcoin')

class TxDestination {
  static TYPE_INVALID = 0;
  static TYPE_PK = 1
  static TYPE_PKH = 2
  static TYPE_SH = 3
  static TYPE_ID = 4
  static TYPE_INDEX = 5
  static TYPE_QUANTUM = 6

  get typeInvalid () {
    return TxDestination.TYPE_INVALID;
  }
  get typePK () {
    return TxDestination.TYPE_PK;
  }
  get isPK () {
    return this.destType === this.typePK
  }
  get typePKH () {
    return TxDestination.TYPE_PKH;
  }
  get isPKH () {
    return this.destType === this.typePKH
  }
  get typeSH () {
    return TxDestination.TYPE_SH;
  }
  get isSH () {
    return this.destType === this.typeSH
  }
  get typeID () {
    return TxDestination.TYPE_ID;
  }
  get isID () {
    return this.destType === this.typeID
  }
  get typeIndex () {
    return TxDestination.TYPE_INDEX;
  }
  get isIndex () {
    return this.destType === this.typeIndex
  }
  get typeQuantum () {
    return TxDestination.TYPE_QUANTUM;
  }
  get isQuantum () {
    return this.destType === this.typeQuantum
  }
  get typeLast () {
    return TxDestination.TYPE_QUANTUM;
  }
  constructor (destType = this.typePKH, destinationBytes = []) {
    this.destType = destType
    this.destinationBytes = destinationBytes
  }

  isValid () {
    return this.destType > this.typeInvalid && this.destType <= this.typeLast && this.destinationBytes && this.destinationBytes.length
  }

  static fromChunk (chunk) {
    var prefix = Buffer.alloc(1)
    prefix.writeUInt8(chunk.length, 0)

    const dest = new TxDestination()

    dest.fromBuffer(Buffer.concat([prefix, chunk]))

    return dest
  }

  fromBuffer (buffer, initialOffset = 0) {
    var offset = initialOffset
    function readSlice (n) {
      offset += n
      return buffer.slice(offset - n, offset)
    }

    function readVarInt () {
      var vi = varuint.decode(buffer, offset)
      offset += varuint.decode.bytes
      return vi
    }

    function readVarSlice () {
      return readSlice(readVarInt())
    }

    const destByteVector = readVarSlice()

    if (destByteVector.length === 20) {
      this.destType = this.typePKH
      this.destinationBytes = destByteVector
    } else if (destByteVector.length === 33) {
      this.destType = this.typePK
      this.destinationBytes = destByteVector
    } else {
      this.destType = destByteVector.slice(0, 1).readUInt8(0)
      this.destinationBytes = destByteVector.slice(1)
    }
    return offset
  }

  __byteLength () {
    if (this.destType === this.typePKH) {
      return 21
    } else if (this.destType === this.typePK) {
      return 34
    } else {
      return varuint.encodingLength(this.destinationBytes.length + 1) + this.destinationBytes.length + 1
    }
  }

  toChunk () {
    return this.toBuffer().slice(1)
  }

  toBuffer (buffer, initialOffset) {
    if (!buffer) buffer = Buffer.allocUnsafe(this.__byteLength())
    var offset = initialOffset || 0
    function writeSlice (slice) { offset += slice.copy(buffer, offset) }
    function writeVarInt (i) {
      varuint.encode(i, buffer, offset)
      offset += varuint.encode.bytes
    }
    function writeVarSlice (slice) { writeVarInt(slice.length); writeSlice(slice) }

    if (this.destType === this.typePKH) {
      if (this.destinationBytes.length !== 20) {
        throw new TypeError('invalid length for typePKH destination bytes')
      }
      writeVarSlice(this.destinationBytes)
    } else if (this.destType === this.typePK) {
      if (this.destinationBytes.length !== 33) {
        throw new TypeError('invalid length for typePK destination bytes')
      }
      writeVarSlice(this.destinationBytes)
    } else {
      const combinedVector = Buffer.alloc(1 + this.destinationBytes.length)
      combinedVector.writeUInt8(this.destType, 0)

      this.destinationBytes.forEach((x, index) => {
        combinedVector.writeUInt8(x, index + 1)
      })

      writeVarSlice(combinedVector)
    }

    // avoid slicing unless necessary
    if (initialOffset !== undefined) return buffer.slice(initialOffset, offset)
    // TODO (https://github.com/BitGo/bitgo-utxo-lib/issues/11): we shouldn't have to slice the final buffer
    return buffer.slice(0, offset)
  }
}

module.exports = TxDestination
