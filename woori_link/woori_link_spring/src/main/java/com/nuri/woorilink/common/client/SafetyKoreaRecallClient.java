package com.nuri.woorilink.common.client;

import com.fasterxml.jackson.databind.*; import com.nuri.woorilink.common.config.PublicDataConfig;
import lombok.RequiredArgsConstructor; import org.springframework.stereotype.Component; import org.springframework.web.util.UriComponentsBuilder;
import java.io.*; import java.net.*; import java.nio.charset.StandardCharsets; import java.util.*;

@Component @RequiredArgsConstructor
public class SafetyKoreaRecallClient {
 private final PublicDataConfig config; private final ObjectMapper mapper;
 public Lookup lookup(ProductQuery q){
  if(blank(config.getRecallApiKey())) return Lookup.fail("4000","AUTH_KEY_MISSING","인증키가 없습니다.");
  LinkedHashMap<String,NoticePayload> found=new LinkedHashMap<>(); String code="2004",msg="조회 데이터 없음";
  for(Query query:queries(q)){
   Result list=call(config.getRecallListUrl(),Map.of("conditionKey",query.type,"conditionValue",query.value));
   if(!list.success) return Lookup.fail(list.code,errorCode(list.code),list.message);
   code=list.code; msg=list.message;
   for(JsonNode item:list.items){ String uid=text(item,"recallUid"); if(uid.isBlank()) continue;
    Result detail=call(config.getRecallDetailUrl(),Map.of("recallUid",uid));
    JsonNode detailNode=detail.success&&!detail.items.isEmpty()?detail.items.get(0):item;
    found.putIfAbsent(uid,new NoticePayload(uid,item,detailNode,!detail.success,detail.code,detail.message));
   }
  }
  return new Lookup(true,code,msg,null,null,new ArrayList<>(found.values()));
 }
 public Lookup fetchAll(){if(blank(config.getRecallApiKey()))return Lookup.fail("4000","AUTH_KEY_MISSING","인증키가 없습니다.");Result list=call(config.getRecallListUrl(),Map.of("conditionKey","all","conditionValue","all"));if(!list.success)return Lookup.fail(list.code,errorCode(list.code),list.message);List<NoticePayload>out=new ArrayList<>();for(JsonNode item:list.items){String uid=text(item,"recallUid");if(uid.isBlank())continue;Result detail=call(config.getRecallDetailUrl(),Map.of("recallUid",uid));out.add(new NoticePayload(uid,item,detail.success&&!detail.items.isEmpty()?detail.items.get(0):item,!detail.success,detail.code,detail.message));}return new Lookup(true,list.code,list.message,null,null,out);}
 private List<Query> queries(ProductQuery q){ List<Query> out=new ArrayList<>(); add(out,"barcodeNum",q.barcode); add(out,"certNum",q.certificationNumber); add(out,"recallModelName",q.modelNumber); add(out,"recallProductName",q.productName); add(out,"recallBrandName",q.brandName); return out; }
 private void add(List<Query> out,String type,String value){ if(!blank(value)) out.add(new Query(type,value.trim())); }
 private Result call(String base,Map<String,String> params){
  try{ UriComponentsBuilder b=UriComponentsBuilder.fromUriString(base); params.forEach(b::queryParam); String url=b.build().encode().toUriString();
   HttpURLConnection c=(HttpURLConnection)new URL(url).openConnection(); c.setRequestProperty("AuthKey",config.getRecallApiKey()); c.setRequestProperty("Accept","application/json"); c.setConnectTimeout(config.getRecallConnectTimeoutMs()); c.setReadTimeout(config.getRecallReadTimeoutMs());
   int status=c.getResponseCode(); InputStream in=status>=200&&status<300?c.getInputStream():c.getErrorStream(); String body=in==null?"":new String(in.readAllBytes(),StandardCharsets.UTF_8); if(in!=null)in.close(); c.disconnect();
   if(status<200||status>=300)return Result.fail("HTTP_"+status,"HTTP 오류"); JsonNode root=mapper.readTree(body); String code=text(root,"resultCode"),message=text(root,"resultMsg"); if("2004".equals(code))return Result.ok(code,message,List.of()); if(!"2000".equals(code))return Result.fail(code,message);
   JsonNode data=root.get("resultData"); List<JsonNode> items=new ArrayList<>(); if(data==null||data.isNull())return Result.ok(code,message,items); if(data.isArray())data.forEach(items::add); else if(data.isObject())items.add(data); else return Result.fail("INVALID_RESPONSE","응답 형식 오류"); return Result.ok(code,message,items);
  }catch(SocketTimeoutException e){return Result.fail("TIMEOUT","응답 시간 초과");}catch(com.fasterxml.jackson.core.JsonProcessingException e){return Result.fail("INVALID_JSON","JSON 파싱 실패");}catch(Exception e){return Result.fail("NETWORK_ERROR",e.getMessage());}
 }
 private String errorCode(String code){return switch(code==null?"":code){case"4000"->"INVALID_AUTH_KEY";case"4001"->"UNAUTHORIZED_IP";case"4005"->"INVALID_PARAMETER";case"5000"->"EXTERNAL_SERVER_ERROR";default->code;};}
 private String text(JsonNode n,String f){JsonNode v=n==null?null:n.get(f);return v==null||v.isNull()?"":v.asText("").trim();} private boolean blank(String v){return v==null||v.isBlank();}
 public record ProductQuery(String productName,String brandName,String manufacturer,String modelNumber,String barcode,String certificationNumber){}
 public record NoticePayload(String recallUid,JsonNode listItem,JsonNode detailItem,boolean detailFailed,String detailCode,String detailMessage){}
 public record Lookup(boolean success,String resultCode,String resultMessage,String errorCode,String errorMessage,List<NoticePayload> notices){static Lookup fail(String c,String e,String m){return new Lookup(false,c,m,e,m,List.of());}}
 private record Query(String type,String value){} private record Result(boolean success,String code,String message,List<JsonNode>items){static Result ok(String c,String m,List<JsonNode>i){return new Result(true,c,m,i);}static Result fail(String c,String m){return new Result(false,c,m,List.of());}}
}
