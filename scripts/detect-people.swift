// Prüft Bilder mit der macOS-Bilderkennung (Vision) auf Menschen.
// Liest Bildpfade zeilenweise von stdin und gibt pro Bild eine JSON-Zeile aus:
// {"path": "...", "people": 2, "largest": 0.18, "faces": 1}
// – people: erkannte Personen, largest: Flächenanteil der größten Person (0–1).
//
// Aufruf: find public/images -name '*.jpg' | swift scripts/detect-people.swift > import/people.jsonl

import Foundation
import Vision

while let line = readLine() {
    let path = line.trimmingCharacters(in: .whitespaces)
    if path.isEmpty { continue }
    let url = URL(fileURLWithPath: path)

    let humans = VNDetectHumanRectanglesRequest()
    humans.upperBodyOnly = false
    let faces = VNDetectFaceRectanglesRequest()
    let handler = VNImageRequestHandler(url: url, options: [:])

    var people = 0
    var largest = 0.0
    var faceCount = 0
    do {
        try handler.perform([humans, faces])
        let found = (humans.results ?? []).filter { $0.confidence > 0.6 }
        people = found.count
        largest = found.map { Double($0.boundingBox.width * $0.boundingBox.height) }.max() ?? 0
        faceCount = (faces.results ?? []).filter { $0.confidence > 0.6 }.count
    } catch {
        // nicht lesbare Bilder zählen als „ohne Menschen“
    }

    let escaped = path.replacingOccurrences(of: "\\", with: "\\\\").replacingOccurrences(of: "\"", with: "\\\"")
    print("{\"path\": \"\(escaped)\", \"people\": \(people), \"largest\": \(String(format: "%.3f", largest)), \"faces\": \(faceCount)}")
    fflush(stdout)
}
