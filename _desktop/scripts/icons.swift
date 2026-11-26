import AppKit
let root=CommandLine.arguments[1]
let image=NSImage(contentsOfFile:root+"/apps/desktop/public/logo.png")!
let dir=root+"/apps/desktop/src-tauri/icons"
try FileManager.default.createDirectory(atPath:dir+"/icon.iconset",withIntermediateDirectories:true)
func render(_ size:Int, template:Bool=false)->Data {
 let bitmap=NSBitmapImageRep(bitmapDataPlanes:nil,pixelsWide:size,pixelsHigh:size,bitsPerSample:8,samplesPerPixel:4,hasAlpha:true,isPlanar:false,colorSpaceName:.deviceRGB,bytesPerRow:0,bitsPerPixel:0)!
 NSGraphicsContext.saveGraphicsState();NSGraphicsContext.current=NSGraphicsContext(bitmapImageRep:bitmap)
 let bounds=NSRect(x:0,y:0,width:size,height:size)
 if !template {NSColor(calibratedRed:0.055,green:0.065,blue:0.09,alpha:1).setFill();NSBezierPath(roundedRect:bounds,xRadius:CGFloat(size)*0.22,yRadius:CGFloat(size)*0.22).fill()}
 // The source has generous transparent padding; crop to the central mark.
 image.draw(in:bounds.insetBy(dx:CGFloat(size)*0.15,dy:CGFloat(size)*0.15),from:NSRect(x:image.size.width*0.27,y:image.size.height*0.24,width:image.size.width*0.46,height:image.size.height*0.52),operation:.sourceOver,fraction:1)
 if template {NSColor.black.setFill();bounds.fill(using:.sourceIn)}
 NSGraphicsContext.restoreGraphicsState();return bitmap.representation(using:.png,properties:[:])!
}
for size in [16,32,128,256,512] {try render(size).write(to:URL(fileURLWithPath:dir+"/icon.iconset/icon_\(size)x\(size).png"));try render(size*2).write(to:URL(fileURLWithPath:dir+"/icon.iconset/icon_\(size)x\(size)@2x.png"))}
try render(512).write(to:URL(fileURLWithPath:dir+"/icon.png"))
try render(44,template:true).write(to:URL(fileURLWithPath:dir+"/tray.png"))
