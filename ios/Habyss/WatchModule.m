#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>

@interface RCT_EXTERN_MODULE (WatchModule, RCTEventEmitter)

RCT_EXTERN_METHOD(updateContext : (NSDictionary *)context)
RCT_EXTERN_METHOD(sendMessage : (NSDictionary *)message resolver : (
    RCTPromiseResolveBlock)resolve rejecter : (RCTPromiseRejectBlock)reject)

@end
