/**
 * Compact SSE encoding for packets. Every tick ships every packet, and the
 * object form (`{"id":"p70","x":129,"y":99,"shape":"fire"}`) is mostly keys.
 * Packed form: a shape table plus a flat `[id, x, y, shapeIndex, ...]` array.
 */
export type WirePacket = { id: string; x: number; y: number; shape: string }

export type PackedPackets = { shapes: string[]; data: number[] }

const PACKET_ID = /^p(\d+)$/

/** Returns null when an id is not `p<integer>`; callers then send the object form. */
export function packPackets(packets: readonly WirePacket[]): PackedPackets | null {
  const shapes: string[] = []
  const shapeIndex = new Map<string, number>()
  const data: number[] = new Array(packets.length * 4)
  for (let index = 0; index < packets.length; index++) {
    const packet = packets[index]!
    const id = PACKET_ID.exec(packet.id)
    if (!id) return null
    let shape = shapeIndex.get(packet.shape)
    if (shape === undefined) {
      shape = shapes.length
      shapes.push(packet.shape)
      shapeIndex.set(packet.shape, shape)
    }
    const offset = index * 4
    data[offset] = Number(id[1])
    data[offset + 1] = packet.x
    data[offset + 2] = packet.y
    data[offset + 3] = shape
  }
  return { shapes, data }
}

export function unpackPackets(packed: PackedPackets): WirePacket[] {
  const packets: WirePacket[] = []
  const { shapes, data } = packed
  for (let offset = 0; offset + 3 < data.length; offset += 4) {
    const shape = shapes[data[offset + 3]!]
    if (shape === undefined) continue
    packets.push({ id: `p${data[offset]}`, x: data[offset + 1]!, y: data[offset + 2]!, shape })
  }
  return packets
}
