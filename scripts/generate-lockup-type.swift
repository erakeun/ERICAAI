// Generates only the two text layers. Never reads/writes the original MACH image.
import Foundation
import CoreText
import CoreGraphics
let left:CGFloat=80*340/2172, right:CGFloat=2062*340/2172
func make(_ text:String,_ fontName:String,_ skew:CGFloat,_ height:CGFloat,_ viewHeight:Int,_ color:String,_ file:String) {
 let font=CTFontCreateWithName(fontName as CFString,100,nil)
 let string=NSAttributedString(string:text,attributes:[NSAttributedString.Key(kCTFontAttributeName as String):font])
 let line=CTLineCreateWithAttributedString(string)
 let path=CGMutablePath()
 for run in CTLineGetGlyphRuns(line) as! [CTRun] {
  let n=CTRunGetGlyphCount(run);var glyphs=[CGGlyph](repeating:0,count:n);var positions=[CGPoint](repeating:.zero,count:n)
  CTRunGetGlyphs(run,CFRange(location:0,length:0),&glyphs);CTRunGetPositions(run,CFRange(location:0,length:0),&positions)
  for i in 0..<n {if let glyph=CTFontCreatePathForGlyph(font,glyphs[i],nil){path.addPath(glyph,transform:CGAffineTransform(translationX:positions[i].x,y:positions[i].y))}}
 }
 var slant=CGAffineTransform(a:1,b:0,c:tan(skew*CGFloat.pi/180),d:1,tx:0,ty:0)
 let tilted=path.copy(using:&slant)!, b=tilted.boundingBoxOfPath
 var fit=CGAffineTransform(a:(right-left)/b.width,b:0,c:0,d:-height/b.height,tx:left-b.minX*(right-left)/b.width,ty:1+b.maxY*height/b.height)
 let final=tilted.copy(using:&fit)!
 func p(_ v:CGPoint)->String {String(format:"%.4f %.4f",Double(v.x),Double(v.y))}
 var d=""
 final.applyWithBlock{e in let v=e.pointee;switch v.type {
 case .moveToPoint:d+="M"+p(v.points[0]);case .addLineToPoint:d+="L"+p(v.points[0]);case .addQuadCurveToPoint:d+="Q"+p(v.points[0])+" "+p(v.points[1]);case .addCurveToPoint:d+="C"+p(v.points[0])+" "+p(v.points[1])+" "+p(v.points[2]);case .closeSubpath:d+="Z";@unknown default:break}}
 let svg="<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 340 \(viewHeight)\" role=\"img\" aria-label=\"\(text)\"><title>\(text)</title><path fill=\"\(color)\" d=\"\(d)\"/></svg>\n"
 try! svg.write(toFile:file,atomically:true,encoding:.utf8)
 let r=final.boundingBoxOfPath;print("\(file): bounds \(r), tilt \(skew)deg; target x \(left)...\(right)")
}
make("PROJECT","Arial-BoldMT",24,20,24,"#172d49","assets/mach-project-type.svg")
make("Making Administration Change at Hanyang","ArialMT",0,11.5,15,"#60718a","assets/mach-subtitle-type.svg")
