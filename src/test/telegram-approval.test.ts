import {describe,expect,it} from "vitest";
import {createTelegramApprovalCallbackData,verifyTelegramApprovalCallbackData} from "@/lib/agents/telegram-approval";
describe("Telegram approval callback signatures",()=>{
 it("signs compact callbacks bound to the exact Telegram user and workspace",async()=>{
  const input={approvalId:"approval_123",telegramUserId:"123456",workspaceId:"workspace_1",decision:"approved" as const,secret:"s".repeat(48)};
  const data=await createTelegramApprovalCallbackData(input);
  expect(new TextEncoder().encode(data).byteLength).toBeLessThanOrEqual(64);
  expect(await verifyTelegramApprovalCallbackData({data,telegramUserId:input.telegramUserId,workspaceId:input.workspaceId,secret:input.secret})).toEqual({valid:true,approvalId:"approval_123",decision:"approved"});
  expect(await verifyTelegramApprovalCallbackData({data,telegramUserId:"654321",workspaceId:input.workspaceId,secret:input.secret})).toEqual({valid:false,approvalId:null,decision:null});
  expect(await verifyTelegramApprovalCallbackData({data,telegramUserId:input.telegramUserId,workspaceId:"other",secret:input.secret})).toEqual({valid:false,approvalId:null});
 });
 it("rejects tampered, oversized and malformed callback data",async()=>{
  const input={approvalId:"a1",telegramUserId:"123",workspaceId:"ws1",decision:"rejected" as const,secret:"s".repeat(40)};
  const data=await createTelegramApprovalCallbackData(input);
  expect(await verifyTelegramApprovalCallbackData({data:data.slice(0,-1)+"x",telegramUserId:"123",workspaceId:"ws1",secret:input.secret})).toMatchObject({valid:false});
  expect(await verifyTelegramApprovalCallbackData({data:"x".repeat(65),telegramUserId:"123",workspaceId:"ws1",secret:input.secret})).toMatchObject({valid:false});
  expect(await verifyTelegramApprovalCallbackData({data:"invalid",telegramUserId:"123",workspaceId:"ws1",secret:input.secret})).toMatchObject({valid:false});
 });
 it("binds the approve/reject decision into the callback signature",async()=>{
  const input={approvalId:"approval_456",telegramUserId:"123456",workspaceId:"w_"+ "a".repeat(64),decision:"rejected" as const,secret:"s".repeat(48)};
  const data=await createTelegramApprovalCallbackData(input);
  expect(await verifyTelegramApprovalCallbackData({data,telegramUserId:input.telegramUserId,workspaceId:input.workspaceId,secret:input.secret})).toEqual({valid:true,approvalId:"approval_456",decision:"rejected"});
  expect(await verifyTelegramApprovalCallbackData({data,telegramUserId:input.telegramUserId,workspaceId:input.workspaceId,secret:input.secret+"x"})).toMatchObject({valid:false});
 });

});
