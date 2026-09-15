#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE (SharedDefaults, NSObject)

RCT_EXTERN_METHOD(set : (NSString *)key value : (NSString *)value resolver : (
    RCTPromiseResolveBlock)resolve rejecter : (RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(get : (NSString *)key resolver : (RCTPromiseResolveBlock)
                      resolve rejecter : (RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(getInteger : (NSString *)key resolver : (
    RCTPromiseResolveBlock)resolve rejecter : (RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(getDouble : (NSString *)key resolver : (
    RCTPromiseResolveBlock)resolve rejecter : (RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(getArray : (NSString *)key resolver : (RCTPromiseResolveBlock)
                      resolve rejecter : (RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(remove : (NSString *)key resolver : (RCTPromiseResolveBlock)
                      resolve rejecter : (RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(saveImage : (NSString *)base64 fileName : (NSString *)
                      fileName resolver : (RCTPromiseResolveBlock)
                          resolve rejecter : (RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(reloadTimelines : (RCTPromiseResolveBlock)
                      resolve rejecter : (RCTPromiseRejectBlock)reject)

@end
