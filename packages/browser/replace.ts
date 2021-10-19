import { triggerHandlers } from "core/subscribe";
import options from 'core/options'
import { _global, on, throttle, getLocationHref, replaceOld,calcStayTime } from 'utils/index';
import { EVENTTYPES } from "shared/constant";
import { subscribeEvent } from '../core/subscribe';
import { variableTypeDetection } from '../utils/is';
/**
 * 通过 addReplaceHandler 将指定类型的事件存储在 handlers 中
 * @param hanlder 
 * @returns 
 */
export function addReplaceHandler(hanlder:ReplaceHandler){
  // 先判断该类型事件是否已经替换
  if(!subscribeEvent(hanlder)) return 
  // 替换原生事件，
  // 将 triggerHanlders 触发指定类型事件，在 replace 事件中触发指定类型事件。
  replace(hanlder.type,{
    classList:hanlder.classList ? hanlder.classList: []
  })
}

/**
 * 点击事件监听
 */
function clickReplace() {
  const clickThrottle = throttle(triggerHandlers,options.throttleDelayTime)
  on(
    document,
    'click',
    function (this:any,e:any) {
      // 传递给 triggerHandlers 的参数
      // 触发 handlers 事件 map 中的 DOM 事件
      clickThrottle(EVENTTYPES.CLICK, {
        category: 'click', // 事件类型
        data: e // 将 dom 传递给 callback 函数
      })
    },
    true
  )
}

/**
 * 滚动事件监听,给多个元素设置滚动监听
 * @param targetList 
 */
function scrollReplace(targetList) {
  const scrollThrottle = throttle(triggerHandlers,options.throttleDelayTime)
  targetList.forEach(ele => {
    on(
        ele,
        'scroll',
        function (this:any,e) {
          scrollThrottle(
            EVENTTYPES.SCROLL,
            {
              category: 'scroll',
              data: {
                originEvent:e
              }
            }
          )
        },
        true
      )
  })
}

/**
 * history 事件监听
 */
let lastHref = getLocationHref()
function historyReplace() {
  function historyReplaceFn(originalHistoryFn:(...args:any[])=>void) {
    return function(this:History,...args:any[]) {
      let url = args[2]
      if(url) {
        // 路径是否携带 http 协议
        url = url.indexOf('http') !== -1 ? url : (location.origin + url)
        console.log('url',url)
        const from = lastHref
        const to =  String(url)
      
        lastHref = to 
        // 无论是 popstate 事件触发还是 pushState、replaceState 都触发 history 事件
        triggerHandlers(
          EVENTTYPES.HISTORY, 
          {
             from, 
             to,
             ...calcStayTime.calc()
          }
        )
      }
      // 执行原生 history 相关的 api
      return originalHistoryFn.apply(this,args)
    }
  }
  if(variableTypeDetection.isWindow(_global)) {
    const oldOnpopstate = _global.onpopstate
    // 监听 popstate 事件
    _global.onpopstate = function (this:WindowEventHandlers,e:PopStateEvent ) {
      const to = getLocationHref()
      const from = lastHref
      // 更新上一次路径
      lastHref = to 
      // 触发传入 handlers 的 callback 函数
      triggerHandlers(
        EVENTTYPES.HISTORY, 
        {
           from, 
           to,
           ...calcStayTime.calc()
        }
      )
      oldOnpopstate && oldOnpopstate.apply(this,[e])
    } 
    // 拦截 history.pushState(state, title[, url]) 事件
    replaceOld(_global.history,'pushState', historyReplaceFn)
    // 拦截 history.replaceState(stateObj,title [,url]) 事件
    replaceOld(_global.history, 'replaceState', historyReplaceFn)
  }

}

/**
 * 监听 hash 变化
 */
function hashReplace() {
  if(variableTypeDetection.isWindow(_global)) {
    on(_global, EVENTTYPES.HASHCHANGE, function(e){
      const to = getLocationHref()
      const from = lastHref
      // 更新上一次路径
      lastHref = to 
      triggerHandlers(EVENTTYPES.HASHCHANGE, {
        from,
        to,
        ...calcStayTime.calc()
      })
    })
  }
}
interface ReplaceOptions {
  classList?: string[]
}
function replace(
  type:EVENTTYPES, 
  options: ReplaceOptions
 ) {
  let scrollTargetList:Element[] = []
  const { classList } = options
  if(classList) {
    classList.forEach((key:string)=> {
      scrollTargetList.push(...Array.from(document.querySelectorAll(key)))
    })
  }
  switch (type) {
    case EVENTTYPES.CLICK:
      clickReplace()
      break;
    case EVENTTYPES.SCROLL:
      scrollReplace([document.body as Element].concat(scrollTargetList))
      break;
    case EVENTTYPES.HISTORY: 
      historyReplace()
      break;
    case EVENTTYPES.HASHCHANGE:
      hashReplace()
      break;
  }
}
