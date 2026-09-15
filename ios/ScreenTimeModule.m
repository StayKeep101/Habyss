#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE (ScreenTimeModule, NSObject)

RCT_EXTERN_METHOD(requestAuthorization : (RCTPromiseResolveBlock)
                      resolve reject : (RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(isAuthorized : (RCTPromiseResolveBlock)
                      resolve reject : (RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(presentPicker)
RCT_EXTERN_METHOD(setShieldEnabled : (BOOL)enabled)
RCT_EXTERN_METHOD(hasSelectedApps : (RCTPromiseResolveBlock)
                      resolve reject : (RCTPromiseRejectBlock)reject)

@end
