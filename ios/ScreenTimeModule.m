#import <React/RCTBridgeModule.h>
#import <React/RCTViewManager.h>

@interface RCT_EXTERN_MODULE (ScreenTimeModule, NSObject)

RCT_EXTERN_METHOD(requestAuthorization : (RCTPromiseResolveBlock)
                      resolve reject : (RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(isAuthorized : (RCTPromiseResolveBlock)
                      resolve reject : (RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(presentPicker)
RCT_EXTERN_METHOD(presentGuardedPicker : (BOOL)allowRemoval resolve : (RCTPromiseResolveBlock)
                      resolve reject : (RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(setShieldEnabled : (BOOL)enabled)
RCT_EXTERN_METHOD(setGate : (NSString *)json)
RCT_EXTERN_METHOD(setNight : (NSString *)json)
RCT_EXTERN_METHOD(unlockGate : (nonnull NSNumber *)minutes resolve : (RCTPromiseResolveBlock)
                      resolve reject : (RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(setScrollLines : (NSString *)json)
RCT_EXTERN_METHOD(scrolledToday : (RCTPromiseResolveBlock)
                      resolve reject : (RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(setWallet : (nonnull NSNumber *)spendable)
RCT_EXTERN_METHOD(takePendingUnlocks : (RCTPromiseResolveBlock)
                      resolve reject : (RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(gateOpenUntil : (RCTPromiseResolveBlock)
                      resolve reject : (RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(hasSelectedApps : (RCTPromiseResolveBlock)
                      resolve reject : (RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(pickAppTimeApps : (NSString *)habitId title : (NSString *)title resolve : (RCTPromiseResolveBlock)
                      resolve reject : (RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(appTimeProgress : (NSString *)habitId resolve : (RCTPromiseResolveBlock)resolve reject : (RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(appTimeChosen : (NSString *)habitId resolve : (RCTPromiseResolveBlock)
                      resolve reject : (RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(setAppTimeHabits : (NSString *)json)
RCT_EXTERN_METHOD(takeAppTimeResults : (RCTPromiseResolveBlock)
                      resolve reject : (RCTPromiseRejectBlock)reject)

@end

@interface RCT_EXTERN_MODULE(ScreenTimeReportViewManager, RCTViewManager)
RCT_EXPORT_VIEW_PROPERTY(days, NSNumber)
RCT_EXPORT_VIEW_PROPERTY(offset, NSNumber)
RCT_EXPORT_VIEW_PROPERTY(weekStart, NSNumber)
@end
