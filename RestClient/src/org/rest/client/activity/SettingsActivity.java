/*******************************************************************************
 * Copyright 2012 Paweł Psztyć
 * 
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * 
 *   http://www.apache.org/licenses/LICENSE-2.0
 * 
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 ******************************************************************************/
package org.rest.client.activity;

import org.rest.client.ClientFactory;
import org.rest.client.RestClient;
import org.rest.client.StatusNotification;
import org.rest.client.SyncAdapter;
import org.rest.client.analytics.GoogleAnalytics;
import org.rest.client.analytics.GoogleAnalyticsApp;
import org.rest.client.event.NotificationsStateChangeEvent;
import org.rest.client.place.SettingsPlace;
import org.rest.client.request.RequestsHistory;
import org.rest.client.storage.store.StoreKeys;
import org.rest.client.ui.SettingsView;

import com.google.gwt.chrome.storage.Storage;
import com.google.gwt.chrome.storage.StorageArea.StorageSimpleCallback;
import com.google.gwt.chrome.storage.SyncStorageArea;
import com.google.gwt.core.client.Callback;
import com.google.gwt.core.client.GWT;
import com.google.gwt.json.client.JSONObject;
import com.google.gwt.json.client.JSONString;
import com.google.gwt.user.client.ui.AcceptsOneWidget;
import com.google.web.bindery.event.shared.EventBus;

/**
 * Activities typically restore state ("wake up"), perform initialization (
 * "set up"), and load a corresponding UI ("show up")
 * 
 * @author Paweł Psztyć
 * 
 */
public class SettingsActivity extends AppActivity implements SettingsView.Presenter {

	@SuppressWarnings("unused")
	private EventBus eventBus;

	final Storage store = GWT.create(Storage.class);
	final SyncStorageArea syncStorage;

	public SettingsActivity(SettingsPlace place, ClientFactory clientFactory) {
		super(clientFactory);
		syncStorage = store.getSync();
	}

	@Override
	public void start(AcceptsOneWidget panel, com.google.gwt.event.shared.EventBus eventBus) {
		this.eventBus = eventBus;
		super.start(panel, eventBus);

		final SettingsView view = clientFactory.getSettingsView();
		view.setPresenter(this);
		panel.setWidget(view.asWidget());

		updateView(view);
	}

	protected void updateView(final SettingsView view) {
		view.setDebugEnabled(RestClient.isDebug());
		view.setHistoryEnabled(RestClient.isHistoryEabled());
		view.setMagicVarsEnabled(SyncAdapter.magicVars);
		view.setCodeMirrorHeadersEnabled(SyncAdapter.codeMirrorHeaders);
		view.setCodeMirrorPayloadEnabled(SyncAdapter.codeMirrorPayload);
	}

	@Override
	public void clearHistory() {
		RequestsHistory.clearHistory(new Callback<Boolean, Throwable>() {
			@Override
			public void onSuccess(Boolean result) {
				StatusNotification.notify("History cleared.", StatusNotification.TIME_SHORT);
			}

			@Override
			public void onFailure(Throwable reason) {
				StatusNotification.notify("Unable to clear History Store.");
			}
		});
		GoogleAnalytics.sendEvent("Settings usage", "Clear history", "");
		GoogleAnalyticsApp.sendEvent("Settings usage", "Clear history", "");
	}

	private void saveSetting(final String key, final boolean value) {

		JSONObject setObj = new JSONObject();
		setObj.put(key, new JSONString(String.valueOf(value)));
		syncStorage.set(setObj.getJavaScriptObject(), new StorageSimpleCallback() {
			@Override
			public void onDone() {

				StatusNotification.notify("Settings saved.", StatusNotification.TIME_SHORT);

				if (key.equals(StoreKeys.DEBUG_KEY)) {
					RestClient.setDebug(value);
				} else if (key.equals(StoreKeys.HISTORY_KEY)) {
					if (value == false) {
						clientFactory.getMenuView().hideItem(2);
					} else {
						clientFactory.getMenuView().showItem(2);
					}
				} else if (key.equals(StoreKeys.NOTIFICATIONS_ENABLED_KEY)) {
					clientFactory.getEventBus().fireEvent(new NotificationsStateChangeEvent(value));
				} else if (key.equals(StoreKeys.MAGIC_VARS_ENABLED_KEY)) {
					SyncAdapter.magicVars = (value);
				} else if (key.equals(StoreKeys.CODE_MIRROR_HEADERS_KEY)) {
					SyncAdapter.codeMirrorHeaders = (value);
				} else if (key.equals(StoreKeys.CODE_MIRROR_PAYLOAD_KEY)) {
					SyncAdapter.codeMirrorPayload = (value);
				}
			}

			@Override
			public void onError(String message) {
				StatusNotification.notify("Save error: " + message, StatusNotification.TIME_SHORT);
			}
		});
		// GoogleAnalytics.sendEvent("Settings usage", key+" enabled",
		// value+"");
		// GoogleAnalyticsApp.sendEvent("Settings usage", key+" enabled",
		// value+"");
	}

	@Override
	public void changeDebugValue(boolean newValue) {
		saveSetting(StoreKeys.DEBUG_KEY, newValue);
		GoogleAnalytics.sendEvent("Settings usage", "Debug enabled", newValue + "");
		GoogleAnalyticsApp.sendEvent("Settings usage", "Debug enabled", newValue + "");
	}

	@Override
	public void changeHistoryValue(boolean newValue) {
		saveSetting(StoreKeys.HISTORY_KEY, newValue);
		GoogleAnalytics.sendEvent("Settings usage", "History enabled", newValue + "");
		GoogleAnalyticsApp.sendEvent("Settings usage", "History enabled", newValue + "");
	}

	@Override
	public void changeNotificationsValue(boolean notificationsEnabled) {
		saveSetting(StoreKeys.NOTIFICATIONS_ENABLED_KEY, notificationsEnabled);
		GoogleAnalytics.sendEvent("Settings usage", "Notifications enabled", notificationsEnabled + "");
		GoogleAnalyticsApp.sendEvent("Settings usage", "Notifications enabled", notificationsEnabled + "");
	}

	@Override
	public void changeMagicVarsValue(boolean magicVarsEnabled) {
		saveSetting(StoreKeys.MAGIC_VARS_ENABLED_KEY, magicVarsEnabled);
		GoogleAnalytics.sendEvent("Settings usage", "MagicVars enabled", magicVarsEnabled + "");
		GoogleAnalyticsApp.sendEvent("Settings usage", "MagicVars enabled", magicVarsEnabled + "");
	}

	@Override
	public void changeCodeMirrorHeadersValue(boolean codeMirrorHeadersEnabled) {
		saveSetting(StoreKeys.CODE_MIRROR_HEADERS_KEY, codeMirrorHeadersEnabled);
		GoogleAnalytics.sendEvent("Settings usage", "CM headers enabled", codeMirrorHeadersEnabled + "");
		GoogleAnalyticsApp.sendEvent("Settings usage", "CM headers enabled", codeMirrorHeadersEnabled + "");
	}

	@Override
	public void changeCodeMirrorPayloadValue(boolean codeMirrorPayloadEnabled) {
		saveSetting(StoreKeys.CODE_MIRROR_PAYLOAD_KEY, codeMirrorPayloadEnabled);
		GoogleAnalytics.sendEvent("Settings usage", "CM values enabled", codeMirrorPayloadEnabled + "");
		GoogleAnalyticsApp.sendEvent("Settings usage", "CM values enabled", codeMirrorPayloadEnabled + "");
	}
}
